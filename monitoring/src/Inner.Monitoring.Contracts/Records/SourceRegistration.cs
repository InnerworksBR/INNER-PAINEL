namespace Inner.Monitoring.Contracts.Records;

/// <summary>
///     Request para registro de uma nova source (agent ou collector).
/// </summary>
/// <param name="ActivationToken">Token de ativação de uso único (base64url).</param>
/// <param name="SourceType">Tipo: "agent" ou "collector".</param>
/// <param name="InstallationId">UUID de instalação único no host.</param>
/// <param name="DisplayName">Nome de exibição.</param>
/// <param name="Platform">Plataforma: "windows", "linux".</param>
/// <param name="Architecture">Arquitetura: "x64", "arm64".</param>
/// <param name="SourceVersion">Versão semântica do software.</param>
/// <param name="Hostname">Hostname normalizado do host.</param>
/// <param name="MachineFingerprint">Impressão digital da máquina.</param>
/// <param name="Capabilities">Capacidades suportadas pela source.</param>
public sealed record SourceRegistrationRequest(
    string ActivationToken,
    string SourceType,
    Guid InstallationId,
    string DisplayName,
    string Platform,
    string Architecture,
    string SourceVersion,
    string Hostname,
    MachineFingerprint Fingerprint,
    SourceCapabilities Capabilities);

/// <summary>
///     Impressão digital da máquina para identificação.
/// </summary>
/// <param name="SmbiosUuid">UUID SMBIOS normalizado.</param>
/// <param name="MachineIdHash">Hash SHA256 do machine ID.</param>
public sealed record MachineFingerprint(
    string? SmbiosUuid,
    string? MachineIdHash);

/// <summary>
///     Capacidades reportadas pela source.
/// </summary>
/// <param name="HostMetrics">Suporta coleta de métricas de host.</param>
/// <param name="HyperV">Suporta coleta Hyper-V.</param>
/// <param name="SnmpV2c">Suporta SNMP v2c.</param>
/// <param name="SnmpV3">Suporta SNMP v3.</param>
public sealed record SourceCapabilities(
    bool HostMetrics,
    bool HyperV,
    bool SnmpV2c,
    bool SnmpV3);

/// <summary>
///     Response do registro de source.
/// </summary>
/// <param name="SourceId">UUID da source criada.</param>
/// <param name="CompanyId">UUID da empresa.</param>
/// <param name="SiteId">UUID do site.</param>
/// <param name="AccessToken">JWT de acesso (curto).</param>
/// <param name="AccessTokenExpiresAt">Data de expiração do access token.</param>
/// <param name="RefreshToken">Token de refresh (base64url).</param>
/// <param name="RefreshTokenExpiresAt">Data de expiração do refresh token.</param>
/// <param name="HeartbeatIntervalSeconds">Intervalo de heartbeat em segundos.</param>
/// <param name="ConfigVersion">Versão atual da configuração.</param>
/// <param name="Endpoints">URLs dos endpoints.</param>
/// <param name="ServerTime">Tempo do servidor (UTC).</param>
public sealed record SourceRegistrationResponse(
    Guid SourceId,
    Guid CompanyId,
    Guid SiteId,
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt,
    int HeartbeatIntervalSeconds,
    long ConfigVersion,
    SourceEndpoints Endpoints,
    DateTimeOffset ServerTime);

/// <summary>
///     Endpoints da API para a source.
/// </summary/// <param name="Heartbeat">URL do endpoint de heartbeat.</param>
/// <param name="Configuration">URL do endpoint de configuração.</param>
/// <param name="Batches">URL do endpoint de batches.</param>
/// <param name="Commands">URL do endpoint de comandos.</param>
public sealed record SourceEndpoints(
    string Heartbeat,
    string Configuration,
    string Batches,
    string Commands);

/// <summary>
///     Request para refresh de token.
/// </summary>
/// <param name="SourceId">UUID da source.</param>
/// <param name="RefreshToken">Token de refresh atual.</param>
public sealed record TokenRefreshRequest(
    Guid SourceId,
    string RefreshToken);

/// <summary>
///     Response do refresh de token.
/// </summary>
/// <param name="AccessToken">Novo JWT de acesso.</param>
/// <param name="AccessTokenExpiresAt">Nova data de expiração.</param>
/// <param name="RefreshToken">Novo token de refresh.</param>
/// <param name="RefreshTokenExpiresAt">Nova data de expiração do refresh.</param>
public sealed record TokenRefreshResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);
