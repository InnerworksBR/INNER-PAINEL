namespace Inner.Monitoring.Contracts.Records;

/// <summary>
///     Configuração versionada enviada para a source.
/// </summary>
/// <param name="SchemaVersion">Versão do schema.</param>
/// <param name="ConfigVersion">Versão monotônica da configuração.</param>
/// <param name="EffectiveAt">Quando a configuração passa a vigorar.</param>
/// <param name="ConfigHash">Hash SHA256 da configuração (para ETag).</param>
/// <param name="Common">Configurações comuns a todas as sources.</param>
/// <param name="Agent">Configurações específicas do agent (null se collector).</param>
/// <param name="Collector">Configurações específicas do collector (null se agent).</param>
/// <param name="AllowedCommands">Lista de comandos permitidos.</param>
public sealed record SourceConfiguration(
    int SchemaVersion,
    long ConfigVersion,
    DateTimeOffset EffectiveAt,
    string ConfigHash,
    CommonConfiguration Common,
    AgentConfiguration? Agent,
    CollectorConfiguration? Collector,
    IReadOnlyList<string> AllowedCommands);

/// <summary>
///     Configurações comuns a todas as sources.
/// </summary>
/// <param name="HeartbeatIntervalSeconds">Intervalo de heartbeat.</param>
/// <param name="BatchFlushSeconds">Intervalo de flush de batch.</param>
/// <param name="BatchMaxRecords">Máximo de records por batch.</param>
/// <param name="BatchTargetCompressedBytes">Tamanho alvo comprimido.</param>
/// <param name="BatchMaxCompressedBytes">Tamanho máximo comprimido.</param>
/// <param name="BatchMaxUncompressedBytes">Tamanho máximo descomprimido.</param>
/// <param name="OutboxMaxBytes">Limite máximo da outbox.</param>
/// <param name="OutboxMaxAgeSeconds">Idade máxima na outbox.</param>
/// <param name="HttpTimeoutSeconds">Timeout de requisições HTTP.</param>
/// <param name="LogLevel">Nível de log.</param>
public sealed record CommonConfiguration(
    int HeartbeatIntervalSeconds,
    int BatchFlushSeconds,
    int BatchMaxRecords,
    long BatchTargetCompressedBytes,
    long BatchMaxCompressedBytes,
    long BatchMaxUncompressedBytes,
    long OutboxMaxBytes,
    int OutboxMaxAgeSeconds,
    int HttpTimeoutSeconds,
    string LogLevel);

/// <summary>
///     Configurações específicas do agent.
/// </summary>
/// <param name="CollectionIntervalSeconds">Intervalo de coleta.</param>
/// <param name="EnabledCollectors">Lista de coletores habilitados.</param>
/// <param name="Capabilities">Capacidades a reportar.</param>
public sealed record AgentConfiguration(
    int CollectionIntervalSeconds,
    IReadOnlyList<string> EnabledCollectors,
    IReadOnlyDictionary<string, bool> Capabilities);

/// <summary>
///     Configurações específicas do collector.
/// </summary>
/// <param name="ProbeConcurrency">Concorrência de probes.</param>
/// <param name="PollConcurrency">Concorrência de polling.</param>
/// <param name="MaxRequestsPerSecond">Máximo de requisições por segundo.</param>
/// <param name="PerTargetRequestsPerSecond">Máximo por target.</param>
/// <param name="DefaultTimeoutMs">Timeout padrão em ms.</param>
/// <param name="DefaultRetries">Número padrão de retries.</param>
/// <param name="Ranges">Ranges de rede configurados.</param>
/// <param name="Profiles">Perfis de coleta.</param>
public sealed record CollectorConfiguration(
    int ProbeConcurrency,
    int PollConcurrency,
    int MaxRequestsPerSecond,
    int PerTargetRequestsPerSecond,
    int DefaultTimeoutMs,
    int DefaultRetries,
    IReadOnlyList<NetworkRangeConfig> Ranges,
    IReadOnlyList<CollectionProfileConfig> Profiles);

/// <summary>
///     Configuração de um range de rede.
/// </summary>
/// <param name="RangeId">UUID do range.</param>
/// <param name="Cidr">CIDR do range.</param>
/// <param name="Exclusions">Lista de CIDRs excluídos.</param>
/// <param name="Enabled">Se o range está habilitado.</param>
/// <param name="DiscoveryIntervalSeconds">Intervalo de descoberta.</param>
/// <param name="PollProfileId">UUID do perfil de polling.</param>
public sealed record NetworkRangeConfig(
    Guid RangeId,
    string Cidr,
    IReadOnlyList<string> Exclusions,
    bool Enabled,
    int DiscoveryIntervalSeconds,
    Guid? PollProfileId);

/// <summary>
///     Configuração de um perfil de coleta.
/// </summary>
/// <param name="ProfileId">UUID do perfil.</param>
/// <param name="Version">Versão do perfil.</param>
/// <param name="PollIntervalSeconds">Intervalo de polling.</param>
/// <param name="TimeoutMs">Timeout em ms.</param>
/// <param name="Retries">Número de retries.</param>
/// <param name="Queries">Queries SNMP.</param>
public sealed record CollectionProfileConfig(
    Guid ProfileId,
    int Version,
    int PollIntervalSeconds,
    int TimeoutMs,
    int Retries,
    IReadOnlyList<SnmpQueryConfig> Queries);

/// <summary>
///     Configuração de uma query SNMP.
/// </summary>
/// <param name="Operation">Operação: "get" ou "bulk_walk".</param>
/// <param name="Oids">Lista de OIDs.</param>
/// <param name="RootOid">Root OID para walk.</param>
/// <param name="MaxRepetitions">Max repetições para bulk.</param>
public sealed record SnmpQueryConfig(
    string Operation,
    IReadOnlyList<string>? Oids,
    string? RootOid,
    int? MaxRepetitions);
