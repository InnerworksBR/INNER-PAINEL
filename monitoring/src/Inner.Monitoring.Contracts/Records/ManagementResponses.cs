namespace Inner.Monitoring.Contracts.Records;

/// <summary>
/// Resposta de token de ativação.
/// </summary>
public sealed record ActivationTokenResponse(
    Guid Id,
    string DisplayHint,
    string? TokenPreview,
    DateTimeOffset ExpiresAt,
    Guid CompanyId,
    Guid SiteId,
    string SourceType,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UsedAt);

/// <summary>
/// Requisição para criar token de ativação.
/// </summary>
public sealed record CreateActivationTokenRequest(
    Guid SiteId,
    string SourceType,
    string? DisplayHint,
    int? ValidityMinutes);

/// <summary>
/// Credenciais SNMP.
/// </summary>
public sealed record SnmpCredentialResponse(
    Guid Id,
    Guid CompanyId,
    Guid SiteId,
    string Name,
    string Version,
    string? SecurityLevel,
    string? Username,
    string? AuthProtocol,
    string? PrivacyProtocol,
    string Status,
    string? Fingerprint,
    DateTimeOffset CreatedAt,
    DateTimeOffset? RotatedAt);

/// <summary>
/// Requisição para criar credencial SNMP.
/// </summary>
public sealed record CreateSnmpCredentialRequest(
    Guid SiteId,
    string Name,
    string Version,
    string? SecurityLevel,
    string? Username,
    string? AuthProtocol,
    string? PrivacyProtocol,
    string AuthPassword,
    string? PrivacyPassword);

/// <summary>
/// Network range.
/// </summary>
public sealed record NetworkRangeResponse(
    Guid Id,
    Guid CompanyId,
    Guid SiteId,
    string? SiteName,
    string Name,
    string Cidr,
    string? Description,
    string Status,
    int DiscoveryIntervalMinutes,
    DateTimeOffset? LastDiscoveryAt,
    DateTimeOffset CreatedAt);

/// <summary>
/// Resposta de health da plataforma.
/// </summary>
public sealed record PlatformHealthResponse(
    string Status,
    DateTimeOffset Timestamp,
    DatabaseHealth Database,
    ApiHealth Api);

/// <summary>
/// Health do banco de dados.
/// </summary>
public sealed record DatabaseHealth(
    string Status,
    int ConnectionPoolSize,
    int ActiveConnections,
    long QueryDurationMs);

/// <summary>
/// Health da API.
/// </summary>
public sealed record ApiHealth(
    string Status,
    double UptimeSeconds,
    int ActiveSseConnections,
    int RequestsPerMinute);
