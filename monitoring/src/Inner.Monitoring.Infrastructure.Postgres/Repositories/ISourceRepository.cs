using Inner.Monitoring.Domain.Entities;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Interface para repositório de Sources.
/// </summary>
public interface ISourceRepository
{
    Task<Source?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Source?> GetByInstallationIdAsync(Guid installationId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Source>> GetByCompanyIdAsync(Guid companyId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default);
    Task<Source?> GetActiveByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(Source source, CancellationToken cancellationToken = default);
    Task UpdateAsync(Source source, CancellationToken cancellationToken = default);

    // Sequence cursor
    Task<SourceSequenceCursor?> GetSequenceCursorAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task<SourceSequenceCursor> GetOrCreateSequenceCursorAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task UpdateSequenceCursorAsync(SourceSequenceCursor cursor, CancellationToken cancellationToken = default);

    // Credentials
    Task<SourceCredential?> GetActiveCredentialAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task<SourceCredential?> GetCredentialByRefreshTokenHashAsync(string hash, CancellationToken cancellationToken = default);
    Task AddCredentialAsync(SourceCredential credential, CancellationToken cancellationToken = default);
    Task UpdateCredentialAsync(SourceCredential credential, CancellationToken cancellationToken = default);

    // Configuration
    Task<SourceConfiguration?> GetActiveConfigurationAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task<SourceConfiguration?> GetConfigurationByVersionAsync(Guid sourceId, long version, CancellationToken cancellationToken = default);
    Task AddConfigurationAsync(SourceConfiguration config, CancellationToken cancellationToken = default);

    // Heartbeats
    Task AddHeartbeatAsync(SourceHeartbeat heartbeat, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SourceHeartbeat>> GetRecentHeartbeatsAsync(Guid sourceId, int count = 10, CancellationToken cancellationToken = default);

    // Details
    Task<AgentDetails?> GetAgentDetailsAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task<CollectorDetails?> GetCollectorDetailsAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task AddOrUpdateAgentDetailsAsync(AgentDetails details, CancellationToken cancellationToken = default);
    Task AddOrUpdateCollectorDetailsAsync(CollectorDetails details, CancellationToken cancellationToken = default);

    // Tokens
    Task<ActivationToken?> GetTokenByHashAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task AddTokenAsync(ActivationToken token, CancellationToken cancellationToken = default);
    Task UpdateTokenAsync(ActivationToken token, CancellationToken cancellationToken = default);
}
