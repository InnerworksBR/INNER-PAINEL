using Microsoft.Data.Sqlite;

namespace Inner.Network.Agent.Persistence;

public sealed record PendingNetworkBatch(long Sequence, string Payload, int ByteLength);
public sealed record InterfaceCounterSample(ulong Octets, ulong UptimeTicks, ulong DiscontinuityTicks, DateTimeOffset ObservedAt, bool Restarted);
public sealed record NetworkTarget(string NetworkId, string ScopeId, string IpAddress, Guid DeviceUid, DateTimeOffset LastSuccessAt);
public sealed record NetworkOutboxStatus(long CreatedSequence, long AcknowledgedSequence, int PendingCount, long PendingBytes);

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
            CREATE TABLE IF NOT EXISTS device_aliases(scope_id TEXT NOT NULL, kind TEXT NOT NULL, alias_value TEXT NOT NULL, device_uid TEXT NOT NULL, PRIMARY KEY(scope_id,kind,alias_value,device_uid));
            CREATE INDEX IF NOT EXISTS ix_device_alias_lookup ON device_aliases(scope_id,kind,alias_value);
            CREATE TABLE IF NOT EXISTS network_targets(network_id TEXT NOT NULL, scope_id TEXT NOT NULL, ip_address TEXT NOT NULL, device_uid TEXT NOT NULL, last_success_at TEXT NOT NULL, PRIMARY KEY(network_id,ip_address));
            CREATE INDEX IF NOT EXISTS ix_network_targets_identity ON network_targets(scope_id,device_uid);
            CREATE TABLE IF NOT EXISTS interface_counters(device_uid TEXT NOT NULL, if_index INTEGER NOT NULL, direction TEXT NOT NULL, octets TEXT NOT NULL, uptime_ticks TEXT NOT NULL, discontinuity_ticks TEXT NOT NULL DEFAULT '0', observed_at TEXT NOT NULL, PRIMARY KEY(device_uid, if_index, direction));
            CREATE TABLE IF NOT EXISTS outbox(sequence INTEGER PRIMARY KEY, payload TEXT NOT NULL, byte_length INTEGER NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS rejected_batches(sequence INTEGER PRIMARY KEY, status_code INTEGER NOT NULL, reason TEXT NOT NULL, rejected_at TEXT NOT NULL);
            INSERT OR IGNORE INTO state(key, value) VALUES ('sequence', '0');
            INSERT OR IGNORE INTO state(key, value) VALUES ('acknowledged_sequence', '0');
            INSERT OR IGNORE INTO state(key, value) VALUES ('discovery_state', 'idle');
            """;
        await command.ExecuteNonQueryAsync(ct);
        await EnsureColumnAsync(connection, "interface_counters", "discontinuity_ticks", "TEXT NOT NULL DEFAULT '0'", ct);
    }

    public async Task<Guid> ResolveAndUpsertTargetAsync(string networkId, string scopeId, string ipAddress,
        string? engineId, string? serialNumber, DateTimeOffset observedAt, TimeSpan trustedIdentityFreshWindow,
        CancellationToken ct = default)
    {
        var trusted = new List<(string Kind, string Value)>();
        if (NormalizeTrusted(engineId) is { Length: > 0 } engine) trusted.Add(("engine", engine));
        if (NormalizeTrusted(serialNumber) is { Length: > 0 } serial) trusted.Add(("serial", serial));
        var ipKey = $"{scopeId}|ip|{ipAddress}";
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);

        var existingTarget = await ReadTargetUidAsync(connection, transaction, networkId, ipAddress, ct);
        var targetIdentityConflict = false;
        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var alias in trusted)
        {
            await using var lookup = connection.CreateCommand();
            lookup.Transaction = transaction;
            lookup.CommandText = "SELECT device_uid FROM device_aliases WHERE scope_id=$scope AND kind=$kind AND alias_value=$value";
            lookup.Parameters.AddWithValue("$scope", scopeId);
            lookup.Parameters.AddWithValue("$kind", alias.Kind);
            lookup.Parameters.AddWithValue("$value", alias.Value);
            await using var reader = await lookup.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) candidates.Add(reader.GetString(0));
        }

        if (existingTarget is not null && trusted.Count > 0)
        {
            var stored = await ReadTrustedAliasesAsync(connection, transaction, scopeId, existingTarget, ct);
            var hasContradictoryIdentity = trusted.Any(alias =>
                stored.TryGetValue(alias.Kind, out var values) &&
                (values.Count != 1 || !values.Contains(alias.Value)));
            if (hasContradictoryIdentity)
            {
                existingTarget = null;
                targetIdentityConflict = true;
            }
        }

        string? uid = existingTarget;
        // More than one stored device claiming the same trusted identifier is
        // ambiguous even when none currently has a fresh target. Never fall
        // back to an IP alias in that case, which could silently merge it.
        var trustedIdentityIsCurrentlyAmbiguous = candidates.Count > 1;
        if (uid is null && !targetIdentityConflict && candidates.Count == 1)
        {
            var candidate = candidates.Single();
            var cutoff = (observedAt - trustedIdentityFreshWindow).ToString("O");
            await using var active = connection.CreateCommand();
            active.Transaction = transaction;
            active.CommandText = "SELECT 1 FROM network_targets WHERE scope_id=$scope AND device_uid=$uid AND ip_address<>$ip AND last_success_at >= $cutoff LIMIT 1";
            active.Parameters.AddWithValue("$scope", scopeId);
            active.Parameters.AddWithValue("$uid", candidate);
            active.Parameters.AddWithValue("$ip", ipAddress);
            active.Parameters.AddWithValue("$cutoff", cutoff);
            if (await active.ExecuteScalarAsync(ct) is null) uid = candidate;
            else trustedIdentityIsCurrentlyAmbiguous = true;
        }
        if (uid is null && !targetIdentityConflict && !trustedIdentityIsCurrentlyAmbiguous && candidates.Count <= 1)
        {
            await using var ipAlias = connection.CreateCommand();
            ipAlias.Transaction = transaction;
            ipAlias.CommandText = "SELECT device_uid FROM device_aliases WHERE scope_id=$scope AND kind='ip' AND alias_value=$ip";
            ipAlias.Parameters.AddWithValue("$scope", scopeId);
            ipAlias.Parameters.AddWithValue("$ip", ipAddress);
            var matches = new List<string>();
            await using var reader = await ipAlias.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) matches.Add(reader.GetString(0));
            if (matches.Count == 1) uid = matches[0];
        }
        if (uid is null && !targetIdentityConflict && !trustedIdentityIsCurrentlyAmbiguous && candidates.Count == 0)
        {
            var legacyKey = ipKey;
            await using var legacy = connection.CreateCommand();
            legacy.Transaction = transaction;
            legacy.CommandText = "SELECT device_uid FROM devices WHERE identity_key=$key LIMIT 1";
            legacy.Parameters.AddWithValue("$key", legacyKey);
            uid = (string?)await legacy.ExecuteScalarAsync(ct);
        }
        uid ??= Guid.NewGuid().ToString("D");

        await using (var device = connection.CreateCommand())
        {
            device.Transaction = transaction;
            device.CommandText = "INSERT OR IGNORE INTO devices(identity_key,device_uid) VALUES ($key,$uid)";
            device.Parameters.AddWithValue("$key", ipKey);
            device.Parameters.AddWithValue("$uid", uid);
            await device.ExecuteNonQueryAsync(ct);
        }
        await AddAliasAsync(connection, transaction, scopeId, "ip", ipAddress, uid, ct);
        foreach (var alias in trusted) await AddAliasAsync(connection, transaction, scopeId, alias.Kind, alias.Value, uid, ct);

        if (candidates.Count == 1 && string.Equals(uid, candidates.Single(), StringComparison.OrdinalIgnoreCase))
        {
            await using var move = connection.CreateCommand();
            move.Transaction = transaction;
            move.CommandText = "DELETE FROM network_targets WHERE scope_id=$scope AND device_uid=$uid AND ip_address<>$ip AND last_success_at < $cutoff";
            move.Parameters.AddWithValue("$scope", scopeId);
            move.Parameters.AddWithValue("$uid", uid);
            move.Parameters.AddWithValue("$ip", ipAddress);
            move.Parameters.AddWithValue("$cutoff", (observedAt - trustedIdentityFreshWindow).ToString("O"));
            await move.ExecuteNonQueryAsync(ct);
        }

        await using (var target = connection.CreateCommand())
        {
            target.Transaction = transaction;
            target.CommandText = "INSERT INTO network_targets(network_id,scope_id,ip_address,device_uid,last_success_at) VALUES ($network,$scope,$ip,$uid,$success) ON CONFLICT(network_id,ip_address) DO UPDATE SET scope_id=excluded.scope_id,device_uid=excluded.device_uid,last_success_at=excluded.last_success_at";
            target.Parameters.AddWithValue("$network", networkId);
            target.Parameters.AddWithValue("$scope", scopeId);
            target.Parameters.AddWithValue("$ip", ipAddress);
            target.Parameters.AddWithValue("$uid", uid);
            target.Parameters.AddWithValue("$success", observedAt.ToString("O"));
            await target.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
        return Guid.Parse(uid);
    }

    public async Task<IReadOnlyList<NetworkTarget>> GetKnownTargetsAsync(CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT network_id,scope_id,ip_address,device_uid,last_success_at FROM network_targets ORDER BY network_id,ip_address";
        var targets = new List<NetworkTarget>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) targets.Add(new(reader.GetString(0), reader.GetString(1), reader.GetString(2), Guid.Parse(reader.GetString(3)), DateTimeOffset.Parse(reader.GetString(4))));
        return targets;
    }

    public async Task RemoveTargetAsync(string networkId, string ipAddress, CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM network_targets WHERE network_id=$network AND ip_address=$ip";
        command.Parameters.AddWithValue("$network", networkId);
        command.Parameters.AddWithValue("$ip", ipAddress);
        await command.ExecuteNonQueryAsync(ct);
    }

    public Task<DateTimeOffset?> GetLastDiscoveryAtAsync(CancellationToken ct = default) => ReadDateAsync("last_discovery_at", ct);

    public async Task<int> GetLastDiscoveredDeviceCountAsync(CancellationToken ct = default) =>
        int.TryParse(await ReadValueAsync("last_discovered_devices", ct), out var count) ? count : 0;

    public async Task<int?> GetLastDiscoveryConfigVersionAsync(CancellationToken ct = default) =>
        int.TryParse(await ReadValueAsync("last_discovery_config_version", ct), out var version) ? version : null;

    public async Task<string> GetDiscoveryStateAsync(CancellationToken ct = default) => await ReadValueAsync("discovery_state", ct) ?? "idle";

    public async Task SaveDiscoveryStateAsync(string state, CancellationToken ct = default) => await SaveValueAsync("discovery_state", state, ct);

    public async Task MarkDiscoveryCompleteAsync(DateTimeOffset at, int discoveredDevices, int configVersion, CancellationToken ct = default)
    {
        await SaveValueAsync("last_discovery_at", at.ToString("O"), ct);
        await SaveValueAsync("last_discovered_devices", discoveredDevices.ToString(System.Globalization.CultureInfo.InvariantCulture), ct);
        await SaveValueAsync("last_discovery_config_version", configVersion.ToString(System.Globalization.CultureInfo.InvariantCulture), ct);
        await SaveValueAsync("discovery_state", "complete", ct);
    }

    public async Task<NetworkOutboxStatus> GetOutboxStatusAsync(CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*),COALESCE(SUM(byte_length),0) FROM outbox";
        int pendingCount;
        long pendingBytes;
        await using var reader = await command.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        pendingCount = reader.GetInt32(0);
        pendingBytes = reader.GetInt64(1);
        await reader.DisposeAsync();
        return new(long.TryParse(await ReadValueAsync("sequence", ct), out var created) ? created : 0,
            long.TryParse(await ReadValueAsync("acknowledged_sequence", ct), out var acked) ? acked : 0,
            pendingCount, pendingBytes);
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
        DateTimeOffset observedAt, ulong discontinuityTicks = 0, CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        InterfaceCounterSample? previous = null;
        await using (var read = connection.CreateCommand())
        {
            read.Transaction = transaction;
            read.CommandText = "SELECT octets, uptime_ticks, discontinuity_ticks, observed_at FROM interface_counters WHERE device_uid=$uid AND if_index=$index AND direction=$direction";
            read.Parameters.AddWithValue("$uid", deviceUid);
            read.Parameters.AddWithValue("$index", ifIndex);
            read.Parameters.AddWithValue("$direction", direction);
            await using var reader = await read.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct)) previous = new(ulong.Parse(reader.GetString(0)), ulong.Parse(reader.GetString(1)), ulong.Parse(reader.GetString(2)), DateTimeOffset.Parse(reader.GetString(3)), false);
        }
        await using (var upsert = connection.CreateCommand())
        {
            upsert.Transaction = transaction;
            upsert.CommandText = "INSERT INTO interface_counters(device_uid,if_index,direction,octets,uptime_ticks,discontinuity_ticks,observed_at) VALUES ($uid,$index,$direction,$octets,$uptime,$discontinuity,$observed) ON CONFLICT(device_uid,if_index,direction) DO UPDATE SET octets=excluded.octets, uptime_ticks=excluded.uptime_ticks, discontinuity_ticks=excluded.discontinuity_ticks, observed_at=excluded.observed_at";
            upsert.Parameters.AddWithValue("$uid", deviceUid);
            upsert.Parameters.AddWithValue("$index", ifIndex);
            upsert.Parameters.AddWithValue("$direction", direction);
            upsert.Parameters.AddWithValue("$octets", octets.ToString(System.Globalization.CultureInfo.InvariantCulture));
            upsert.Parameters.AddWithValue("$uptime", uptimeTicks.ToString(System.Globalization.CultureInfo.InvariantCulture));
            upsert.Parameters.AddWithValue("$discontinuity", discontinuityTicks.ToString(System.Globalization.CultureInfo.InvariantCulture));
            upsert.Parameters.AddWithValue("$observed", observedAt.ToString("O"));
            await upsert.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
        if (previous is null) return null;
        return previous with { Restarted = uptimeTicks < previous.UptimeTicks || octets < previous.Octets || discontinuityTicks != previous.DiscontinuityTicks };
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
        var current = long.TryParse(await ReadValueAsync("acknowledged_sequence", ct), out var previous) ? previous : 0;
        if (sequence > current) await SaveValueAsync("acknowledged_sequence", sequence.ToString(System.Globalization.CultureInfo.InvariantCulture), ct);
    }

    public async Task RejectBatchAsync(long sequence, int statusCode, string reason, CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using (var insert = connection.CreateCommand())
        {
            insert.Transaction = transaction;
            insert.CommandText = "INSERT OR REPLACE INTO rejected_batches(sequence,status_code,reason,rejected_at) VALUES ($sequence,$status,$reason,$at)";
            insert.Parameters.AddWithValue("$sequence", sequence);
            insert.Parameters.AddWithValue("$status", statusCode);
            insert.Parameters.AddWithValue("$reason", reason.Length > 512 ? reason[..512] : reason);
            insert.Parameters.AddWithValue("$at", DateTimeOffset.UtcNow.ToString("O"));
            await insert.ExecuteNonQueryAsync(ct);
        }
        await using (var trim = connection.CreateCommand())
        {
            trim.Transaction = transaction;
            trim.CommandText = "DELETE FROM rejected_batches WHERE sequence NOT IN (SELECT sequence FROM rejected_batches ORDER BY rejected_at DESC LIMIT 100)";
            await trim.ExecuteNonQueryAsync(ct);
        }
        await using (var remove = connection.CreateCommand())
        {
            remove.Transaction = transaction;
            remove.CommandText = "DELETE FROM outbox WHERE sequence=$sequence";
            remove.Parameters.AddWithValue("$sequence", sequence);
            await remove.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
    }

    public async Task<int> GetRejectedBatchCountAsync(CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM rejected_batches";
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture);
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

    private async Task<DateTimeOffset?> ReadDateAsync(string key, CancellationToken ct)
    {
        var value = await ReadValueAsync(key, ct);
        return DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;
    }

    private static async Task<string?> ReadTargetUidAsync(SqliteConnection connection, SqliteTransaction transaction, string networkId, string ipAddress, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT device_uid FROM network_targets WHERE network_id=$network AND ip_address=$ip";
        command.Parameters.AddWithValue("$network", networkId);
        command.Parameters.AddWithValue("$ip", ipAddress);
        return (string?)await command.ExecuteScalarAsync(ct);
    }

    private static async Task AddAliasAsync(SqliteConnection connection, SqliteTransaction transaction, string scopeId, string kind, string value, string deviceUid, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "INSERT OR IGNORE INTO device_aliases(scope_id,kind,alias_value,device_uid) VALUES ($scope,$kind,$value,$uid)";
        command.Parameters.AddWithValue("$scope", scopeId);
        command.Parameters.AddWithValue("$kind", kind);
        command.Parameters.AddWithValue("$value", value);
        command.Parameters.AddWithValue("$uid", deviceUid);
        await command.ExecuteNonQueryAsync(ct);
    }

    private static string? NormalizeTrusted(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim().ToLowerInvariant();
        var compact = normalized.Replace("-", string.Empty).Replace(":", string.Empty).Replace(".", string.Empty).Replace(" ", string.Empty);
        return normalized is "unknown" or "n/a" or "na" or "not available" or "not applicable" or "not set" or "unassigned" or "default" or "none" or "null" or "undefined" or "0" or "-" ||
            compact.Length > 0 && compact.All(character => character == '0') ? null : normalized;
    }

    private static async Task<Dictionary<string, HashSet<string>>> ReadTrustedAliasesAsync(SqliteConnection connection, SqliteTransaction transaction, string scopeId, string deviceUid, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT kind,alias_value FROM device_aliases WHERE scope_id=$scope AND device_uid=$uid AND kind IN ('engine','serial')";
        command.Parameters.AddWithValue("$scope", scopeId);
        command.Parameters.AddWithValue("$uid", deviceUid);
        var aliases = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var kind = reader.GetString(0);
            if (!aliases.TryGetValue(kind, out var values)) aliases[kind] = values = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            values.Add(reader.GetString(1));
        }
        return aliases;
    }

    private static async Task EnsureColumnAsync(SqliteConnection connection, string table, string column, string definition, CancellationToken ct)
    {
        await using var inspect = connection.CreateCommand();
        inspect.CommandText = $"PRAGMA table_info({table})";
        await using var reader = await inspect.ExecuteReaderAsync(ct);
        var found = false;
        while (await reader.ReadAsync(ct)) if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase)) found = true;
        await reader.DisposeAsync();
        if (found) return;
        await using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {definition}";
        await alter.ExecuteNonQueryAsync(ct);
    }

    private async Task<SqliteConnection> OpenAsync(CancellationToken ct)
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
