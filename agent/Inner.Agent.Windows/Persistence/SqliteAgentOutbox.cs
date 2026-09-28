using System.Text.Json;
using System.Text.Json.Serialization;
using Inner.Agent.Windows.Contracts;
using Microsoft.Data.Sqlite;

namespace Inner.Agent.Windows.Persistence;

public sealed class SqliteAgentOutbox : IAgentOutbox
{
    private const int MaxPendingBatches = 1000;
    private const long MaxPendingBytes = 100 * 1024 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly string _connectionString;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private bool _initialized;

    public SqliteAgentOutbox(string dataDirectory)
    {
        Directory.CreateDirectory(dataDirectory);
        var path = Path.Combine(dataDirectory, "agent.db");
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        }.ToString();

        SQLitePCL.Batteries_V2.Init();
    }

    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS agent_outbox (
                sequence INTEGER PRIMARY KEY,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                accepted_at TEXT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                next_attempt_at TEXT NULL,
                last_error TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS agent_outbox_pending_idx
                ON agent_outbox(status, sequence);
            CREATE TABLE IF NOT EXISTS agent_sequence (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_sequence INTEGER NOT NULL DEFAULT 0,
                last_accepted_sequence INTEGER NOT NULL DEFAULT 0
            );
            INSERT OR IGNORE INTO agent_sequence(id, last_sequence) VALUES (1, 0);
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
        await EnsureColumnAsync(connection, "agent_outbox", "attempts", "INTEGER NOT NULL DEFAULT 0", cancellationToken);
        await EnsureColumnAsync(connection, "agent_outbox", "next_attempt_at", "TEXT NULL", cancellationToken);
        await EnsureColumnAsync(connection, "agent_outbox", "last_error", "TEXT NULL", cancellationToken);
        await EnsureColumnAsync(connection, "agent_sequence", "last_accepted_sequence", "INTEGER NOT NULL DEFAULT 0", cancellationToken);
        _initialized = true;
    }

    public async Task<long> EnqueueAsync(MetricBatch batch, CancellationToken cancellationToken)
    {
        EnsureInitialized();
        var validated = MetricBatchContract.Validate(batch);
        await _writeLock.WaitAsync(cancellationToken);
        try
        {
            await using var connection = await OpenConnectionAsync(cancellationToken);
            await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);

            await using var nextCommand = connection.CreateCommand();
            nextCommand.Transaction = transaction;
            nextCommand.CommandText = """
                UPDATE agent_sequence SET last_sequence = last_sequence + 1 WHERE id = 1;
                SELECT last_sequence FROM agent_sequence WHERE id = 1;
                """;
            var sequence = Convert.ToInt64(await nextCommand.ExecuteScalarAsync(cancellationToken));
            var storedBatch = validated with { Sequence = sequence };
            var payload = JsonSerializer.Serialize(storedBatch, JsonOptions);

            int pendingCount;
            long pendingBytes;
            await using (var capacityCommand = connection.CreateCommand())
            {
                capacityCommand.Transaction = transaction;
                capacityCommand.CommandText = """
                    SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
                           COALESCE(SUM(CASE WHEN status = 'pending' THEN LENGTH(payload) ELSE 0 END), 0)
                      FROM agent_outbox;
                    """;
                await using var capacityReader = await capacityCommand.ExecuteReaderAsync(cancellationToken);
                await capacityReader.ReadAsync(cancellationToken);
                pendingCount = capacityReader.GetInt32(0);
                pendingBytes = capacityReader.GetInt64(1);
            }
            if (pendingCount >= MaxPendingBatches || pendingBytes + payload.Length > MaxPendingBytes)
            {
                throw new InvalidOperationException("Agent outbox capacity reached; collection will retry later.");
            }

            await using var insertCommand = connection.CreateCommand();
            insertCommand.Transaction = transaction;
            insertCommand.CommandText = """
                INSERT INTO agent_outbox(sequence, payload, status, created_at)
                VALUES ($sequence, $payload, 'pending', $created_at);
                """;
            insertCommand.Parameters.AddWithValue("$sequence", sequence);
            insertCommand.Parameters.AddWithValue("$payload", payload);
            insertCommand.Parameters.AddWithValue("$created_at", DateTimeOffset.UtcNow.ToString("O"));
            await insertCommand.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return sequence;
        }
        finally
        {
            _writeLock.Release();
        }
    }

    public async Task<IReadOnlyList<PendingMetric>> GetPendingAsync(int limit, CancellationToken cancellationToken)
    {
        EnsureInitialized();
        var result = new List<PendingMetric>();
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT sequence, payload, created_at, attempts
              FROM agent_outbox
             WHERE status = 'pending'
               AND (next_attempt_at IS NULL OR next_attempt_at <= $now)
             ORDER BY sequence
             LIMIT $limit;
            """;
        command.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 100));
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new PendingMetric(
                reader.GetInt64(0),
                reader.GetString(1),
                DateTimeOffset.Parse(reader.GetString(2)),
                reader.GetInt32(3)));
        }
        return result;
    }

    public async Task MarkAcceptedAsync(long sequence, CancellationToken cancellationToken)
    {
        EnsureInitialized();
        await _writeLock.WaitAsync(cancellationToken);
        try
        {
            await using var connection = await OpenConnectionAsync(cancellationToken);
            await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);

            await using var sequenceCommand = connection.CreateCommand();
            sequenceCommand.Transaction = transaction;
            sequenceCommand.CommandText = """
                UPDATE agent_sequence
                   SET last_accepted_sequence = MAX(last_accepted_sequence, $sequence)
                 WHERE id = 1;
                """;
            sequenceCommand.Parameters.AddWithValue("$sequence", sequence);
            await sequenceCommand.ExecuteNonQueryAsync(cancellationToken);

            await using var deleteCommand = connection.CreateCommand();
            deleteCommand.Transaction = transaction;
            deleteCommand.CommandText = "DELETE FROM agent_outbox WHERE sequence = $sequence;";
            deleteCommand.Parameters.AddWithValue("$sequence", sequence);
            await deleteCommand.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    public async Task MarkRejectedAsync(long sequence, string error, CancellationToken cancellationToken)
    {
        EnsureInitialized();
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE agent_outbox
               SET status = 'rejected', last_error = $error, accepted_at = NULL
             WHERE sequence = $sequence;
            """;
        command.Parameters.AddWithValue("$sequence", sequence);
        command.Parameters.AddWithValue("$error", error[..Math.Min(error.Length, 1000)]);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task MarkRetryAsync(long sequence, TimeSpan delay, string error, CancellationToken cancellationToken)
    {
        EnsureInitialized();
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE agent_outbox
               SET attempts = attempts + 1,
                   next_attempt_at = $next_attempt_at,
                   last_error = $error
             WHERE sequence = $sequence AND status = 'pending';
            """;
        command.Parameters.AddWithValue("$sequence", sequence);
        command.Parameters.AddWithValue("$next_attempt_at", DateTimeOffset.UtcNow.Add(delay).ToString("O"));
        command.Parameters.AddWithValue("$error", error[..Math.Min(error.Length, 1000)]);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<OutboxStatus> GetStatusAsync(CancellationToken cancellationToken)
    {
        EnsureInitialized();
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var pendingCommand = connection.CreateCommand();
        pendingCommand.CommandText = """
            SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN status = 'pending' THEN LENGTH(payload) ELSE 0 END), 0)
              FROM agent_outbox;
            """;
        await using var pendingReader = await pendingCommand.ExecuteReaderAsync(cancellationToken);
        await pendingReader.ReadAsync(cancellationToken);
        var pendingCount = pendingReader.GetInt32(0);
        var pendingBytes = pendingReader.GetInt64(1);

        await using var sequenceCommand = connection.CreateCommand();
        sequenceCommand.CommandText = "SELECT last_sequence, last_accepted_sequence FROM agent_sequence WHERE id = 1;";
        await using var sequenceReader = await sequenceCommand.ExecuteReaderAsync(cancellationToken);
        await sequenceReader.ReadAsync(cancellationToken);
        return new OutboxStatus(pendingCount, pendingBytes, sequenceReader.GetInt64(0), sequenceReader.GetInt64(1));
    }

    public ValueTask DisposeAsync()
    {
        _writeLock.Dispose();
        return ValueTask.CompletedTask;
    }

    private async Task<SqliteConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private static async Task EnsureColumnAsync(
        SqliteConnection connection,
        string table,
        string column,
        string definition,
        CancellationToken cancellationToken)
    {
        var exists = false;
        await using (var check = connection.CreateCommand())
        {
            check.CommandText = $"PRAGMA table_info({table});";
            await using var reader = await check.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                {
                    exists = true;
                    break;
                }
            }
        }
        if (exists) return;

        await using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {definition};";
        await alter.ExecuteNonQueryAsync(cancellationToken);
    }

    private void EnsureInitialized()
    {
        if (!_initialized) throw new InvalidOperationException("Outbox is not initialized");
    }
}
