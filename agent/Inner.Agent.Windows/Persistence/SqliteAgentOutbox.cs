using System.Text.Json;
using Inner.Agent.Windows.Contracts;
using Microsoft.Data.Sqlite;

namespace Inner.Agent.Windows.Persistence;

public sealed class SqliteAgentOutbox : IAgentOutbox
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
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
                accepted_at TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS agent_outbox_pending_idx
                ON agent_outbox(status, sequence);
            CREATE TABLE IF NOT EXISTS agent_sequence (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_sequence INTEGER NOT NULL DEFAULT 0
            );
            INSERT OR IGNORE INTO agent_sequence(id, last_sequence) VALUES (1, 0);
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
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
            SELECT sequence, payload, created_at
              FROM agent_outbox
             WHERE status = 'pending'
             ORDER BY sequence
             LIMIT $limit;
            """;
        command.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 100));
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new PendingMetric(
                reader.GetInt64(0),
                reader.GetString(1),
                DateTimeOffset.Parse(reader.GetString(2))));
        }
        return result;
    }

    public async Task MarkAcceptedAsync(long sequence, CancellationToken cancellationToken)
    {
        EnsureInitialized();
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE agent_outbox
               SET status = 'accepted', accepted_at = $accepted_at
             WHERE sequence = $sequence;
            """;
        command.Parameters.AddWithValue("$sequence", sequence);
        command.Parameters.AddWithValue("$accepted_at", DateTimeOffset.UtcNow.ToString("O"));
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<OutboxStatus> GetStatusAsync(CancellationToken cancellationToken)
    {
        EnsureInitialized();
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN status = 'pending' THEN LENGTH(payload) ELSE 0 END), 0),
                   COALESCE(MAX(sequence), 0),
                   COALESCE(MAX(CASE WHEN status = 'accepted' THEN sequence ELSE 0 END), 0)
              FROM agent_outbox;
            """;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return new OutboxStatus(reader.GetInt32(0), reader.GetInt64(1), reader.GetInt64(2), reader.GetInt64(3));
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

    private void EnsureInitialized()
    {
        if (!_initialized) throw new InvalidOperationException("Outbox is not initialized");
    }
}
