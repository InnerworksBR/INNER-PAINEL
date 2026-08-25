namespace Inner.Monitoring.Contracts.Records;

/// <summary>
///     Payload de heartbeat enviado pela source.
/// </summary>
/// <param name="SourceTime">Tempo local da source (UTC).</param>
/// <param name="UptimeSeconds">Tempo de atividade em segundos.</param>
/// <param name="SourceVersion">Versão atual do software.</param>
/// <param name="ConfigVersion">Versão da configuração em uso.</param>
/// <param name="LastCreatedSequence">Última sequência criada localmente.</param>
/// <param name="LastAckedSequence">Última sequência confirmada pelo servidor.</param>
/// <param name="Outbox">Estado da outbox local.</param>
/// <param name="Collection">Resultado do último ciclo de coleta.</param>
/// <param name="Capabilities">Capacidades atuais.</param>
/// <param name="LocalHealth">Saúde local do serviço.</param>
public sealed record HeartbeatRequest(
    DateTimeOffset SourceTime,
    long UptimeSeconds,
    string SourceVersion,
    long ConfigVersion,
    long LastCreatedSequence,
    long LastAckedSequence,
    OutboxStatus Outbox,
    CollectionStatus Collection,
    SourceCapabilities Capabilities,
    LocalHealthStatus LocalHealth);

/// <summary>
///     Status da outbox local.
/// </summary>
/// <param name="PendingCount">Quantidade de batches pendentes.</param>
/// <param name="PendingBytes">Bytes pendentes.</param>
/// <param name="MaxBytes">Limite máximo de bytes.</param>
/// <param name="OldestPendingAt">Timestamp do batch mais antigo.</param>
/// <param name="WalBytes">Bytes no WAL do SQLite.</param>
public sealed record OutboxStatus(
    int PendingCount,
    long PendingBytes,
    long MaxBytes,
    DateTimeOffset? OldestPendingAt,
    long WalBytes);

/// <summary>
///     Status do último ciclo de coleta.
/// </summary>
/// <param name="LastCycleStartedAt">Quando o ciclo começou.</param>
/// <param name="LastCycleCompletedAt">Quando o ciclo terminou.</param>
/// <param name="LastCycleResult">Resultado: "success", "partial", "failed".</param>
/// <param name="LastErrorCode">Código de erro se falhou.</param>
public sealed record CollectionStatus(
    DateTimeOffset? LastCycleStartedAt,
    DateTimeOffset? LastCycleCompletedAt,
    string? LastCycleResult,
    string? LastErrorCode);

/// <summary>
///     Saúde local do serviço.
/// </summary>
/// <param name="Status">Status: "healthy", "degraded", "unhealthy".</param>
/// <param name="Warnings">Lista de avisos.</param>
public sealed record LocalHealthStatus(
    string Status,
    IReadOnlyList<string> Warnings);

/// <summary>
///     Response do heartbeat.
/// </summary>
/// <param name="ServerTime">Tempo do servidor.</param>
/// <param name="SourceStatus">Status calculado da source.</param>
/// <param name="DesiredConfigVersion">Versão desejada da configuração.</param>
/// <param name="ConfigurationChanged">Se a configuração mudou.</param>
/// <param name="CommandsAvailable">Quantidade de comandos disponíveis.</param>
/// <param name="MinimumVersion">Versão mínima permitida.</param>
/// <param name="RecommendedVersion">Versão recomendada.</param>
/// <param name="VersionStatus">Status da versão.</param>
/// <param name="NextHeartbeatSeconds">Intervalo para próximo heartbeat.</param>
public sealed record HeartbeatResponse(
    DateTimeOffset ServerTime,
    string SourceStatus,
    long DesiredConfigVersion,
    bool ConfigurationChanged,
    int CommandsAvailable,
    string? MinimumVersion,
    string? RecommendedVersion,
    string VersionStatus,
    int NextHeartbeatSeconds);
