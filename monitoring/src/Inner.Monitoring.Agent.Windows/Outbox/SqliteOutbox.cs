using Microsoft.Data.Sqlite;
using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Agent.Windows.Outbox;

/// <summary>
///     Outbox local usando SQLite para persistência offline-first.
/// </summary>
public sealed class SqliteOutbox : IOutbox, IAsyncDisposable
{
    private readonly string _connectionString;
    private readonly string _dbPath;
    private SqliteConnection? _connection;

    public SqliteOutbox(string dataPath)
    {
        _dbPath = Path.Combine(dataPath, "agent.db");
        _connectionString = $"Data Source={_dbPath}";
    }

    public async Task InitializeAsync(CancellationToken ct)
    {
        _connection = new SqliteConnection(_connectionString);
        await _connection.OpenAsync(ct);

        var cmd = _connection.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL UNIQUE,
                sequence INTEGER NOT NULL,
                schema_version INTEGER NOT NULL,
                source_version TEXT NOT NULL,
                sent_at TEXT NOT NULL,
                collected_from TEXT NOT NULL,
                collected_to TEXT NOT NULL,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                sent_at_utc TEXT,
                response TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at);
            CREATE INDEX IF NOT EXISTS idx_outbox_sequence ON outbox(sequence);

            CREATE TABLE IF NOT EXISTS sequence_cursor (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_sequence INTEGER NOT NULL DEFAULT 0,
                last_acked_sequence INTEGER NOT NULL DEFAULT 0
            );

            INSERT OR IGNORE INTO sequence_cursor (id, last_sequence, last_acked_sequence)
            VALUES (1, 0, 0);

            CREATE TABLE IF NOT EXISTS configuration_cache (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                config_version INTEGER NOT NULL,
                config_json TEXT NOT NULL,
                etag TEXT,
                updated_at TEXT NOT NULL
            );
            """;
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<BatchSubmission> CreateBatchAsync(
        IReadOnlyList<BatchRecord> records,
        DateTimeOffset collectedFrom,
        DateTimeOffset collectedTo,
        CancellationToken ct)
    {
        var conn = GetConnection();
        var nextSeq = await GetNextSequenceInternalAsync(ct);

        var batchId = Guid.NewGuid();
        var sentAt = DateTimeOffset.UtcNow;

        var batch = new BatchSubmission(
            SchemaVersion: 1,
            BatchId: batchId,
            Sequence: nextSeq,
            SourceVersion: "1.0.0",
            SentAt: sentAt,
            CollectedFrom: collectedFrom,
            CollectedTo: collectedTo,
            Records: records);

        var payload = System.Text.Json.JsonSerializer.Serialize(batch);

        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO outbox (batch_id, sequence, schema_version, source_version, sent_at, collected_from, collected_to, payload, status, created_at)
            VALUES (@batch_id, @sequence, @schema_version, @source_version, @sent_at, @collected_from, @collected_to, @payload, 'pending', @created_at)
            """;
        cmd.Parameters.AddWithValue("@batch_id", batchId.ToString());
        cmd.Parameters.AddWithValue("@sequence", nextSeq);
        cmd.Parameters.AddWithValue("@schema_version", batch.SchemaVersion);
        cmd.Parameters.AddWithValue("@source_version", batch.SourceVersion);
        cmd.Parameters.AddWithValue("@sent_at", sentAt.ToString("O"));
        cmd.Parameters.AddWithValue("@collected_from", collectedFrom.ToString("O"));
        cmd.Parameters.AddWithValue("@collected_to", collectedTo.ToString("O"));
        cmd.Parameters.AddWithValue("@payload", payload);
        cmd.Parameters.AddWithValue("@created_at", DateTimeOffset.UtcNow.ToString("O"));

        await cmd.ExecuteNonQueryAsync(ct);
        return batch;
    }

    public async Task<List<(BatchSubmission Batch, string Payload)>> GetPendingBatchesAsync(CancellationToken ct)
    {
        var conn = GetConnection();
        var result = new List<(BatchSubmission, string)>();

        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT payload FROM outbox
            WHERE status = 'pending'
            ORDER BY sequence ASC
            LIMIT 10
            """;

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var payload = reader.GetString(0);
            var batch = System.Text.Json.JsonSerializer.Deserialize<BatchSubmission>(payload);
            if (batch != null)
            {
                result.Add((batch, payload));
            }
        }

        return result;
    }

    public async Task MarkBatchSentAsync(Guid batchId, string? responseJson, CancellationToken ct)
    {
        var conn = GetConnection();
        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE outbox
            SET status = 'sent', sent_at_utc = @sent_at, response = @response
            WHERE batch_id = @batch_id
            """;
        cmd.Parameters.AddWithValue("@batch_id", batchId.ToString());
        cmd.Parameters.AddWithValue("@sent_at", DateTimeOffset.UtcNow.ToString("O"));
        cmd.Parameters.AddWithValue("@response", responseJson ?? (object)DBNull.Value);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<OutboxStatus> GetStatusAsync(CancellationToken ct)
    {
        var conn = GetConnection();

        var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT
                COUNT(*) as pending_count,
                COALESCE(SUM(LENGTH(payload)), 0) as pending_bytes,
                COALESCE(MIN(created_at), NULL) as oldest_pending_at
            FROM outbox
            WHERE status = 'pending'
            """;

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);

        var pendingCount = reader.GetInt32(0);
        var pendingBytes = reader.GetInt64(1);
        var oldestPendingAtStr = reader.IsDBNull(2) ? null : reader.GetString(2);
        DateTimeOffset? oldestPendingAt = oldestPendingAtStr != null
            ? DateTimeOffset.Parse(oldestPendingAtStr)
            : null;

        // Get WAL size
        var walBytes = 0L;
        try
        {
            var walPath = _dbPath + "-wal";
            if (File.Exists(walPath))
                walBytes = new FileInfo(walPath).Length;
        }
        catch { }

        return new OutboxStatus(
            PendingCount: pendingCount,
            PendingBytes: pendingBytes,
            MaxBytes: 50 * 1024 * 1024, // 50MB max
            OldestPendingAt: oldestPendingAt,
            WalBytes: walBytes);
    }

    public async Task<long> GetNextSequenceAsync(CancellationToken ct)
    {
        return await GetNextSequenceInternalAsync(ct);
    }

    private async Task<long> GetNextSequenceInternalAsync(CancellationToken ct)
    {
        var conn = GetConnection();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE sequence_cursor SET last_sequence = last_sequence + 1 WHERE id = 1; SELECT last_sequence FROM sequence_cursor WHERE id = 1;";

        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt64(result);
    }

    public async Task<long> GetLastAckedSequenceAsync(CancellationToken ct)
    {
        var conn = GetConnection();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT last_acked_sequence FROM sequence_cursor WHERE id = 1;";

        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt64(result);
    }

    public async Task UpdateAckedSequenceAsync(long sequence, CancellationToken ct)
    {
        var conn = GetConnection();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE sequence_cursor SET last_acked_sequence = @sequence WHERE id = 1 AND last_acked_sequence < @sequence;";
        cmd.Parameters.AddWithValue("@sequence", sequence);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task PurgeOldBatchesAsync(int maxAgeSeconds, CancellationToken ct)
    {
        var conn = GetConnection();
        var cutoff = DateTimeOffset.UtcNow.AddSeconds(-maxAgeSeconds);

        var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM outbox WHERE status = 'sent' AND created_at < @cutoff;";
        cmd.Parameters.AddWithValue("@cutoff", cutoff.ToString("O"));

        await cmd.ExecuteNonQueryAsync(ct);

        // Vacuum to reclaim space
        var vacuum = conn.CreateCommand();
        vacuum.CommandText = "VACUUM;";
        await vacuum.ExecuteNonQueryAsync(ct);
    }

    private SqliteConnection GetConnection()
    {
        return _connection ?? throw new InvalidOperationException("Outbox not initialized");
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection != null)
        {
            await _connection.CloseAsync();
            await _connection.DisposeAsync();
            _connection = null;
        }
    }
}
