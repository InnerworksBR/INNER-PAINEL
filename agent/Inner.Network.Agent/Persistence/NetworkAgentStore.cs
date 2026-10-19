using Microsoft.Data.Sqlite;

namespace Inner.Network.Agent.Persistence;

public sealed record PendingNetworkBatch(long Sequence, string Payload, int ByteLength);
public sealed record InterfaceCounterSample(ulong Octets, ulong UptimeTicks, DateTimeOffset ObservedAt, bool Restarted);

public sealed class NetworkAgentStore : IAsyncDisposable
{
    private readonly string _connectionString;
    private readonly long _maxBytes;
    private readonly int _maxBatches;

    public NetworkAgentStore(string databasePath, long maxBytes = 100L * 1024 * 1024, int maxBatches = 1000)
    {
        _connectionString = new SqliteConnectionStringBuilder { DataSource = databasePath, Mode = SqliteOpenMode.ReadWriteCreate, Cache = SqliteCacheMode.Shared, Pooling = false }.ToString();
        _maxBytes = maxBytes;
        _maxBatches = maxBatches;
    }

    public async Task InitializeAsync(CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS devices(identity_key TEXT PRIMARY KEY, device_uid TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS interface_counters(device_uid TEXT NOT NULL, if_index INTEGER NOT NULL, direction TEXT NOT NULL, octets TEXT NOT NULL, uptime_ticks TEXT NOT NULL, observed_at TEXT NOT NULL, PRIMARY KEY(device_uid, if_index, direction));
            CREATE TABLE IF NOT EXISTS outbox(sequence INTEGER PRIMARY KEY, payload TEXT NOT NULL, byte_length INTEGER NOT NULL, created_at TEXT NOT NULL);
            INSERT OR IGNORE INTO state(key, value) VALUES ('sequence', '0');
            """;
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<Guid> GetOrCreateDeviceIdAsync(string scopeId, string ipAddress, string? engineId, CancellationToken ct = default)
    {
        var identity = string.IsNullOrWhiteSpace(engineId) ? $"{scopeId}|ip|{ipAddress}" : $"{scopeId}|engine|{engineId.Trim().ToLowerInvariant()}";
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using (var insert = connection.CreateCommand())
        {
            insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO devices(identity_key, device_uid) VALUES ($key, $uid)";
            insert.Parameters.AddWithValue("$key", identity);
            insert.Parameters.AddWithValue("$uid", Guid.NewGuid().ToString("D"));
            await insert.ExecuteNonQueryAsync(ct);
        }
        await using var select = connection.CreateCommand();
        select.Transaction = transaction;
        select.CommandText = "SELECT device_uid FROM devices WHERE identity_key = $key";
        select.Parameters.AddWithValue("$key", identity);
        var result = (string?)await select.ExecuteScalarAsync(ct) ?? throw new InvalidOperationException("Device identity row could not be read.");
        await transaction.CommitAsync(ct);
        return Guid.Parse(result);
    }

    public async Task<long> NextSequenceAsync(CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "UPDATE state SET value = CAST(value AS INTEGER) + 1 WHERE key='sequence'; SELECT CAST(value AS INTEGER) FROM state WHERE key='sequence';";
        var next = (long)(await command.ExecuteScalarAsync(ct) ?? 0L);
        await transaction.CommitAsync(ct);
        return next;
    }

    public async Task<string> GetOrCreateMachineIdAsync(CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        var id = Guid.NewGuid().ToString("D");
        await using (var insert = connection.CreateCommand())
        {
            insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO state(key,value) VALUES ('machine_id',$id)";
            insert.Parameters.AddWithValue("$id", id);
            await insert.ExecuteNonQueryAsync(ct);
        }
        await using var read = connection.CreateCommand();
        read.Transaction = transaction;
        read.CommandText = "SELECT value FROM state WHERE key='machine_id'";
        var result = (string?)await read.ExecuteScalarAsync(ct) ?? throw new InvalidOperationException("Machine identity was not persisted.");
        await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<InterfaceCounterSample?> RecordCounterAsync(
        string deviceUid, int ifIndex, string direction, ulong octets, ulong uptimeTicks,
        DateTimeOffset observedAt, CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        InterfaceCounterSample? previous = null;
        await using (var read = connection.CreateCommand())
        {
            read.Transaction = transaction;
            read.CommandText = "SELECT octets, uptime_ticks, observed_at FROM interface_counters WHERE device_uid=$uid AND if_index=$index AND direction=$direction";
            read.Parameters.AddWithValue("$uid", deviceUid);
            read.Parameters.AddWithValue("$index", ifIndex);
            read.Parameters.AddWithValue("$direction", direction);
            await using var reader = await read.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct)) previous = new(ulong.Parse(reader.GetString(0)), ulong.Parse(reader.GetString(1)), DateTimeOffset.Parse(reader.GetString(2)), false);
        }
        await using (var upsert = connection.CreateCommand())
        {
            upsert.Transaction = transaction;
            upsert.CommandText = "INSERT INTO interface_counters(device_uid,if_index,direction,octets,uptime_ticks,observed_at) VALUES ($uid,$index,$direction,$octets,$uptime,$observed) ON CONFLICT(device_uid,if_index,direction) DO UPDATE SET octets=excluded.octets, uptime_ticks=excluded.uptime_ticks, observed_at=excluded.observed_at";
            upsert.Parameters.AddWithValue("$uid", deviceUid);
            upsert.Parameters.AddWithValue("$index", ifIndex);
            upsert.Parameters.AddWithValue("$direction", direction);
            upsert.Parameters.AddWithValue("$octets", octets.ToString(System.Globalization.CultureInfo.InvariantCulture));
            upsert.Parameters.AddWithValue("$uptime", uptimeTicks.ToString(System.Globalization.CultureInfo.InvariantCulture));
            upsert.Parameters.AddWithValue("$observed", observedAt.ToString("O"));
            await upsert.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
        if (previous is null) return null;
        return previous with { Restarted = uptimeTicks < previous.UptimeTicks || octets < previous.Octets };
    }

    public async Task SaveConfigurationAsync(string configurationJson, CancellationToken ct = default) =>
        await SaveValueAsync("configuration", configurationJson, ct);

    public Task<string?> ReadConfigurationAsync(CancellationToken ct = default) => ReadValueAsync("configuration", ct);

    public async Task EnqueueAsync(long sequence, string payload, CancellationToken ct = default)
    {
        var length = System.Text.Encoding.UTF8.GetByteCount(payload);
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using var stats = connection.CreateCommand();
        stats.Transaction = transaction;
        stats.CommandText = "SELECT COUNT(*), COALESCE(SUM(byte_length), 0) FROM outbox";
        await using var reader = await stats.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        var count = reader.GetInt32(0);
        var bytes = reader.GetInt64(1);
        await reader.DisposeAsync();
        if (count >= _maxBatches || bytes + length > _maxBytes)
            throw new InvalidOperationException("Network metrics outbox limit reached; no batch was discarded.");
        await using var insert = connection.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = "INSERT INTO outbox(sequence, payload, byte_length, created_at) VALUES ($sequence, $payload, $length, $created)";
        insert.Parameters.AddWithValue("$sequence", sequence);
        insert.Parameters.AddWithValue("$payload", payload);
        insert.Parameters.AddWithValue("$length", length);
        insert.Parameters.AddWithValue("$created", DateTimeOffset.UtcNow.ToString("O"));
        await insert.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<PendingNetworkBatch>> ReadPendingAsync(int limit, CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT sequence, payload, byte_length FROM outbox ORDER BY sequence LIMIT $limit";
        command.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 1000));
        var rows = new List<PendingNetworkBatch>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetInt32(2)));
        return rows;
    }

    public async Task AcknowledgeAsync(long sequence, CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM outbox WHERE sequence = $sequence";
        command.Parameters.AddWithValue("$sequence", sequence);
        await command.ExecuteNonQueryAsync(ct);
    }

    private async Task SaveValueAsync(string key, string value, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO state(key,value) VALUES ($key,$value) ON CONFLICT(key) DO UPDATE SET value=excluded.value";
        command.Parameters.AddWithValue("$key", key);
        command.Parameters.AddWithValue("$value", value);
        await command.ExecuteNonQueryAsync(ct);
    }

    private async Task<string?> ReadValueAsync(string key, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT value FROM state WHERE key=$key";
        command.Parameters.AddWithValue("$key", key);
        return (string?)await command.ExecuteScalarAsync(ct);
    }

    private async Task<SqliteConnection> OpenAsync(CancellationToken ct)
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
