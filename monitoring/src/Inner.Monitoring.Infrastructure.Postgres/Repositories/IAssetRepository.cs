using Inner.Monitoring.Domain.Entities;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Interface para repositório de Assets.
/// </summary>
public interface IAssetRepository
{
    Task<Asset?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Asset?> GetByIdOrDefaultAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Asset>> GetByCompanyIdAsync(Guid companyId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Asset>> GetBySiteIdAsync(Guid siteId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default);
    Task<Asset?> GetByHostnameAsync(Guid companyId, string hostname, CancellationToken cancellationToken = default);
    Task<Asset?> GetByPrimaryIpAsync(Guid companyId, string ip, CancellationToken cancellationToken = default);
    Task AddAsync(Asset asset, CancellationToken cancellationToken = default);
    Task UpdateAsync(Asset asset, CancellationToken cancellationToken = default);

    // Identifiers
    Task<AssetIdentifier?> GetIdentifierByHashAsync(Guid companyId, byte[] hash, CancellationToken cancellationToken = default);
    Task<AssetIdentifier?> GetIdentifierByTypeAndValueAsync(Guid companyId, string identifierType, string normalizedValue, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AssetIdentifier>> GetIdentifiersByAssetIdAsync(Guid assetId, CancellationToken cancellationToken = default);
    Task AddIdentifierAsync(AssetIdentifier identifier, CancellationToken cancellationToken = default);
    Task UpdateIdentifierAsync(AssetIdentifier identifier, CancellationToken cancellationToken = default);

    // Bindings
    Task<AssetSourceBinding?> GetBindingAsync(Guid assetId, Guid sourceId, string localAssetId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AssetSourceBinding>> GetBindingsByAssetIdAsync(Guid assetId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AssetSourceBinding>> GetBindingsBySourceIdAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task AddBindingAsync(AssetSourceBinding binding, CancellationToken cancellationToken = default);
    Task UpdateBindingAsync(AssetSourceBinding binding, CancellationToken cancellationToken = default);

    // Current State
    Task<AssetCurrentState?> GetCurrentStateAsync(Guid assetId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AssetCurrentState>> GetStaleStatesAsync(Guid companyId, int staleMinutes = 10, int limit = 1000, CancellationToken cancellationToken = default);
    Task UpsertCurrentStateAsync(AssetCurrentState state, CancellationToken cancellationToken = default);

    // Metric Current
    Task<AssetMetricCurrent?> GetMetricCurrentAsync(Guid assetId, int metricId, byte[] dimensionHash, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AssetMetricCurrent>> GetMetricCurrentsByAssetAsync(Guid assetId, CancellationToken cancellationToken = default);
    Task UpsertMetricCurrentAsync(AssetMetricCurrent metric, CancellationToken cancellationToken = default);

    // Conflicts
    Task<AssetIdentityConflict?> GetConflictByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AssetIdentityConflict>> GetOpenConflictsAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default);
    Task AddConflictAsync(AssetIdentityConflict conflict, CancellationToken cancellationToken = default);
    Task UpdateConflictAsync(AssetIdentityConflict conflict, CancellationToken cancellationToken = default);
}
