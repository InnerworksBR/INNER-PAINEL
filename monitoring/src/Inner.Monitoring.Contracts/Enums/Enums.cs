namespace Inner.Monitoring.Contracts.Enums;

/// <summary>
///     Tipo de source que envia dados de monitoramento.
/// </summary>
public enum SourceType
{
    Agent,
    Collector
}

/// <summary>
///     Status atual de uma source.
/// </summary>
public enum SourceStatus
{
    Pending,
    Online,
    Degraded,
    Offline,
    Revoked,
    Upgrading
}

/// <summary>
///     Nível de segurança SNMP v3.
/// </summary>
public enum SnmpSecurityLevel
{
    NoAuthNoPriv,
    AuthNoPriv,
    AuthPriv
}

/// <summary>
///     Resultado de uma tentativa de coleta.
/// </summary>
public enum CollectionResult
{
    Success,
    Timeout,
    AuthenticationError,
    ProtocolError,
    Unsupported,
    Cancelled,
    CollectorError
}

/// <summary>
///     Qualidade de uma amostra de métrica.
/// </summary>
public enum MetricQuality
{
    Good,
    Estimated,
    Partial,
    Unsupported,
    Invalid,
    ClockSkewed
}

/// <summary>
///     Tipo semântico de uma métrica.
/// </summary>
public enum MetricSemanticType
{
    Gauge,
    Counter,
    State,
    Text,
    Inventory
}

/// <summary>
///     Classe de retenção de uma métrica.
/// </summary>
public enum RetentionClass
{
    CurrentOnly,
    Realtime,
    Standard,
    Inventory
}

/// <summary>
///     Tipo de asset monitorado.
/// </summary>
public enum AssetType
{
    WindowsHost,
    HyperVHost,
    HyperVVM,
    Switch,
    Router,
    AccessPoint,
    Printer,
    Ups,
    Firewall,
    NetworkDevice,
    UnknownDevice
}

/// <summary>
///     Estado de saúde de um asset.
/// </summary>
public enum HealthStatus
{
    Healthy,
    Warning,
    Stale,
    Offline,
    Unknown,
    Maintenance
}

/// <summary>
///     Status de um batch de ingestão.
/// </summary>
public enum BatchStatus
{
    Received,
    Processing,
    Processed,
    Retrying,
    DeadLetter,
    Archived
}

/// <summary>
///     Status de um job de processamento.
/// </summary>
public enum JobStatus
{
    Pending,
    Leased,
    Retrying,
    Completed,
    DeadLetter
}

/// <summary>
///     Status de um comando.
/// </summary>
public enum CommandStatus
{
    Pending,
    Leased,
    Running,
    Succeeded,
    Failed,
    Expired,
    Cancelled
}

/// <summary>
///     Confiança de um identificador de asset.
/// </summary>
public enum IdentifierConfidence
{
    Strong,
    Medium,
    Weak
}

/// <summary>
///     Status de um identificador.
/// </summary>
public enum IdentifierStatus
{
    Active,
    Conflicted,
    Retired
}

/// <summary>
///     Status de ciclo de vida de um asset.
/// </summary>
public enum LifecycleStatus
{
    Active,
    Maintenance,
    Retired,
    Deleted,
    Conflicted
}

/// <summary>
///     Severidade de um evento.
/// </summary>
public enum EventSeverity
{
    Info,
    Warning,
    Critical
}

/// <summary>
///     Estado de um evento.
/// </summary>
public enum EventState
{
    Open,
    Acknowledged,
    Resolved
}
