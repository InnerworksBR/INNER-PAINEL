using Inner.Monitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Repositório de Sources.
/// </summary>
public class SourceRepository : ISourceRepository
{
    private readonly MonitoringDbContext _context;

    public SourceRepository(MonitoringDbContext context)
    {
        _context = context;
    }

    public async Task<Source?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Sources
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }

    public async Task<Source?> GetByInstallationIdAsync(Guid installationId, CancellationToken cancellationToken = default)
    {
        return await _context.Sources
            .FirstOrDefaultAsync(s => s.InstallationId == installationId, cancellationToken);
    }

    public async Task<IReadOnlyList<Source>> GetByCompanyIdAsync(Guid companyId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default)
    {
        return await _context.Sources
            .Where(s => s.CompanyId == companyId)
            .OrderByDescending(s => s.LastHeartbeatAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<Source?> GetActiveByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Sources
            .FirstOrDefaultAsync(s => s.Id == id && s.DeletedAt == null, cancellationToken);
    }

    public async Task AddAsync(Source source, CancellationToken cancellationToken = default)
    {
        await _context.Sources.AddAsync(source, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Source source, CancellationToken cancellationToken = default)
    {
        _context.Sources.Update(source);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Sequence Cursor
    public async Task<SourceSequenceCursor?> GetSequenceCursorAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        return await _context.SourceSequenceCursors
            .FirstOrDefaultAsync(c => c.SourceId == sourceId, cancellationToken);
    }

    public async Task<SourceSequenceCursor> GetOrCreateSequenceCursorAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        var cursor = await GetSequenceCursorAsync(sourceId, cancellationToken);
        if (cursor != null) return cursor;

        cursor = SourceSequenceCursor.Create(sourceId);
        await _context.SourceSequenceCursors.AddAsync(cursor, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return cursor;
    }

    public async Task UpdateSequenceCursorAsync(SourceSequenceCursor cursor, CancellationToken cancellationToken = default)
    {
        _context.SourceSequenceCursors.Update(cursor);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Credentials
    public async Task<SourceCredential?> GetActiveCredentialAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        return await _context.SourceCredentials
            .Where(c => c.SourceId == sourceId && c.RevokedAt == null && c.ExpiresAt > now)
            .OrderByDescending(c => c.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<SourceCredential?> GetCredentialByRefreshTokenHashAsync(string hash, CancellationToken cancellationToken = default)
    {
        return await _context.SourceCredentials
            .FirstOrDefaultAsync(c => c.RefreshTokenHash == hash, cancellationToken);
    }

    public async Task AddCredentialAsync(SourceCredential credential, CancellationToken cancellationToken = default)
    {
        await _context.SourceCredentials.AddAsync(credential, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateCredentialAsync(SourceCredential credential, CancellationToken cancellationToken = default)
    {
        _context.SourceCredentials.Update(credential);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Configuration
    public async Task<SourceConfiguration?> GetActiveConfigurationAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        return await _context.SourceConfigurations
            .Where(c => c.SourceId == sourceId && c.Status == "active")
            .OrderByDescending(c => c.Version)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<SourceConfiguration?> GetConfigurationByVersionAsync(Guid sourceId, long version, CancellationToken cancellationToken = default)
    {
        return await _context.SourceConfigurations
            .FirstOrDefaultAsync(c => c.SourceId == sourceId && c.Version == version, cancellationToken);
    }

    public async Task AddConfigurationAsync(SourceConfiguration config, CancellationToken cancellationToken = default)
    {
        await _context.SourceConfigurations.AddAsync(config, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Heartbeats
    public async Task AddHeartbeatAsync(SourceHeartbeat heartbeat, CancellationToken cancellationToken = default)
    {
        await _context.SourceHeartbeats.AddAsync(heartbeat, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SourceHeartbeat>> GetRecentHeartbeatsAsync(Guid sourceId, int count = 10, CancellationToken cancellationToken = default)
    {
        return await _context.SourceHeartbeats
            .Where(h => h.SourceId == sourceId)
            .OrderByDescending(h => h.ReceivedAt)
            .Take(count)
            .ToListAsync(cancellationToken);
    }

    // Details
    public async Task<AgentDetails?> GetAgentDetailsAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        return await _context.AgentDetails
            .FirstOrDefaultAsync(d => d.SourceId == sourceId, cancellationToken);
    }

    public async Task<CollectorDetails?> GetCollectorDetailsAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        return await _context.CollectorDetails
            .FirstOrDefaultAsync(d => d.SourceId == sourceId, cancellationToken);
    }

    public async Task AddOrUpdateAgentDetailsAsync(AgentDetails details, CancellationToken cancellationToken = default)
    {
        var existing = await GetAgentDetailsAsync(details.SourceId, cancellationToken);
        if (existing == null)
        {
            await _context.AgentDetails.AddAsync(details, cancellationToken);
        }
        else
        {
            _context.Entry(existing).CurrentValues.SetValues(details);
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddOrUpdateCollectorDetailsAsync(CollectorDetails details, CancellationToken cancellationToken = default)
    {
        var existing = await GetCollectorDetailsAsync(details.SourceId, cancellationToken);
        if (existing == null)
        {
            await _context.CollectorDetails.AddAsync(details, cancellationToken);
        }
        else
        {
            _context.Entry(existing).CurrentValues.SetValues(details);
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Tokens
    public async Task<ActivationToken?> GetTokenByHashAsync(string tokenHash, CancellationToken cancellationToken = default)
    {
        return await _context.ActivationTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);
    }

    public async Task AddTokenAsync(ActivationToken token, CancellationToken cancellationToken = default)
    {
        await _context.ActivationTokens.AddAsync(token, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateTokenAsync(ActivationToken token, CancellationToken cancellationToken = default)
    {
        _context.ActivationTokens.Update(token);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
