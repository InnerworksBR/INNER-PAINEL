using Inner.Monitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Repositório de Assets.
/// </summary>
public class AssetRepository : IAssetRepository
{
    private readonly MonitoringDbContext _context;

    public AssetRepository(MonitoringDbContext context)
    {
        _context = context;
    }

    public async Task<Asset?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }

    public async Task<Asset?> GetByIdOrDefaultAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Asset>> GetByCompanyIdAsync(Guid companyId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .Where(a => a.CompanyId == companyId && a.DeletedAt == null)
            .OrderByDescending(a => a.LastSeenAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Asset>> GetBySiteIdAsync(Guid siteId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .Where(a => a.SiteId == siteId && a.DeletedAt == null)
            .OrderByDescending(a => a.LastSeenAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<Asset?> GetByHostnameAsync(Guid companyId, string hostname, CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Hostname == hostname && a.DeletedAt == null, cancellationToken);
    }

    public async Task<Asset?> GetByPrimaryIpAsync(Guid companyId, string ip, CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.PrimaryIp == ip && a.DeletedAt == null, cancellationToken);
    }

    public async Task AddAsync(Asset asset, CancellationToken cancellationToken = default)
    {
        await _context.Assets.AddAsync(asset, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Asset asset, CancellationToken cancellationToken = default)
    {
        _context.Assets.Update(asset);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Identifiers
    public async Task<AssetIdentifier?> GetIdentifierByHashAsync(Guid companyId, byte[] hash, CancellationToken cancellationToken = default)
    {
        return await _context.AssetIdentifiers
            .Where(i => i.CompanyId == companyId && i.ValueHash == hash && i.Status == Contracts.Enums.IdentifierStatus.Active)
            .OrderByDescending(i => i.Confidence)
            .ThenByDescending(i => i.LastSeenAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<AssetIdentifier?> GetIdentifierByTypeAndValueAsync(Guid companyId, string identifierType, string normalizedValue, CancellationToken cancellationToken = default)
    {
        return await _context.AssetIdentifiers
            .FirstOrDefaultAsync(i => i.CompanyId == companyId && i.IdentifierType == identifierType && i.NormalizedValue == normalizedValue && i.Status == Contracts.Enums.IdentifierStatus.Active, cancellationToken);
    }

    public async Task<IReadOnlyList<AssetIdentifier>> GetIdentifiersByAssetIdAsync(Guid assetId, CancellationToken cancellationToken = default)
    {
        return await _context.AssetIdentifiers
            .Where(i => i.AssetId == assetId)
            .ToListAsync(cancellationToken);
    }

    public async Task AddIdentifierAsync(AssetIdentifier identifier, CancellationToken cancellationToken = default)
    {
        await _context.AssetIdentifiers.AddAsync(identifier, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateIdentifierAsync(AssetIdentifier identifier, CancellationToken cancellationToken = default)
    {
        _context.AssetIdentifiers.Update(identifier);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Bindings
    public async Task<AssetSourceBinding?> GetBindingAsync(Guid assetId, Guid sourceId, string localAssetId, CancellationToken cancellationToken = default)
    {
        return await _context.AssetSourceBindings
            .FirstOrDefaultAsync(b => b.AssetId == assetId && b.SourceId == sourceId && b.LocalAssetId == localAssetId, cancellationToken);
    }

    public async Task<IReadOnlyList<AssetSourceBinding>> GetBindingsByAssetIdAsync(Guid assetId, CancellationToken cancellationToken = default)
    {
        return await _context.AssetSourceBindings
            .Where(b => b.AssetId == assetId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AssetSourceBinding>> GetBindingsBySourceIdAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        return await _context.AssetSourceBindings
            .Where(b => b.SourceId == sourceId && b.Active)
            .ToListAsync(cancellationToken);
    }

    public async Task AddBindingAsync(AssetSourceBinding binding, CancellationToken cancellationToken = default)
    {
        await _context.AssetSourceBindings.AddAsync(binding, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateBindingAsync(AssetSourceBinding binding, CancellationToken cancellationToken = default)
    {
        _context.AssetSourceBindings.Update(binding);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Current State
    public async Task<AssetCurrentState?> GetCurrentStateAsync(Guid assetId, CancellationToken cancellationToken = default)
    {
        return await _context.AssetCurrentStates
            .FirstOrDefaultAsync(s => s.AssetId == assetId, cancellationToken);
    }

    public async Task<IReadOnlyList<AssetCurrentState>> GetStaleStatesAsync(Guid companyId, int staleMinutes = 10, int limit = 1000, CancellationToken cancellationToken = default)
    {
        var staleThreshold = DateTimeOffset.UtcNow.AddMinutes(-staleMinutes);
        return await _context.AssetCurrentStates
            .Where(s => s.CompanyId == companyId && s.LastSuccessAt < staleThreshold)
            .OrderBy(s => s.LastSuccessAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task UpsertCurrentStateAsync(AssetCurrentState state, CancellationToken cancellationToken = default)
    {
        var existing = await GetCurrentStateAsync(state.AssetId, cancellationToken);
        if (existing == null)
        {
            await _context.AssetCurrentStates.AddAsync(state, cancellationToken);
        }
        else
        {
            _context.Entry(existing).CurrentValues.SetValues(state);
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Metric Current
    public async Task<AssetMetricCurrent?> GetMetricCurrentAsync(Guid assetId, int metricId, byte[] dimensionHash, CancellationToken cancellationToken = default)
    {
        return await _context.AssetMetricCurrents
            .FirstOrDefaultAsync(m => m.AssetId == assetId && m.MetricId == metricId && m.DimensionHash == dimensionHash, cancellationToken);
    }

    public async Task<IReadOnlyList<AssetMetricCurrent>> GetMetricCurrentsByAssetAsync(Guid assetId, CancellationToken cancellationToken = default)
    {
        return await _context.AssetMetricCurrents
            .Where(m => m.AssetId == assetId)
            .ToListAsync(cancellationToken);
    }

    public async Task UpsertMetricCurrentAsync(AssetMetricCurrent metric, CancellationToken cancellationToken = default)
    {
        var existing = await GetMetricCurrentAsync(metric.AssetId, metric.MetricId, metric.DimensionHash, cancellationToken);
        if (existing == null)
        {
            await _context.AssetMetricCurrents.AddAsync(metric, cancellationToken);
        }
        else
        {
            _context.Entry(existing).CurrentValues.SetValues(metric);
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Conflicts
    public async Task<AssetIdentityConflict?> GetConflictByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.AssetIdentityConflicts
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<AssetIdentityConflict>> GetOpenConflictsAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default)
    {
        return await _context.AssetIdentityConflicts
            .Where(c => c.CompanyId == companyId && c.Status == "open")
            .OrderBy(c => c.DetectedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task AddConflictAsync(AssetIdentityConflict conflict, CancellationToken cancellationToken = default)
    {
        await _context.AssetIdentityConflicts.AddAsync(conflict, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateConflictAsync(AssetIdentityConflict conflict, CancellationToken cancellationToken = default)
    {
        _context.AssetIdentityConflicts.Update(conflict);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
