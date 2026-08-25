using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Contracts.Interfaces;

/// <summary>
///     Provedor de configuração de aplicação.
/// </summary>
public interface IAppSettings
{
    /// <summary>
    ///     String de conexão do PostgreSQL.
    /// </summary>
    string DatabaseConnectionString { get; }

    /// <summary>
    ///     Chave secreta para signing de JWTs.
    /// </summary>
    string JwtSigningKey { get; }

    /// <summary>
    ///     Issuer dos tokens JWT.
    /// </summary>
    string JwtIssuer { get; }

    /// <summary>
    ///     Audience dos tokens JWT.
    /// </summary>
    string JwtAudience { get; }

    /// <summary>
    ///     Tempo de expiração do access token em minutos.
    /// </summary>
    int AccessTokenExpirationMinutes { get; }

    /// <summary>
    ///     Tempo de expiração do refresh token em dias.
    /// </summary>
    int RefreshTokenExpirationDays { get; }

    /// <summary>
    ///     URL base da API.
    /// </summary>
    string ApiBaseUrl { get; }

    /// <summary>
    ///     Intervalo padrão de heartbeat em segundos.
    /// </summary>
    int DefaultHeartbeatIntervalSeconds { get; }

    /// <summary>
    ///     Tamanho máximo da outbox em bytes para agents.
    /// </summary>
    long AgentOutboxMaxBytes { get; }

    /// <summary>
    ///     Tamanho máximo da outbox em bytes para collectors.
    /// </summary>
    long CollectorOutboxMaxBytes { get; }

    /// <summary>
    ///     Validade do token de ativação em minutos.
    /// </summary>
    int ActivationTokenValidityMinutes { get; }

    /// <summary>
    ///     Quantidade máxima de batches processados por iteração do worker.
    /// </summary>
    int WorkerBatchChunkSize { get; }

    /// <summary>
    ///     Tempo de lease de um job em segundos.
    /// </summary>
    int JobLeaseSeconds { get; }

    /// <summary>
    ///     Número máximo de tentativas de processamento.
    /// </summary>
    int MaxProcessingAttempts { get; }

    /// <summary>
    ///     Se o ambiente é produção.
    /// </summary>
    bool IsProduction { get; }

    /// <summary>
    ///     Se HTTPS é obrigatório.
    /// </summary>
    bool RequireHttps { get; }
}
