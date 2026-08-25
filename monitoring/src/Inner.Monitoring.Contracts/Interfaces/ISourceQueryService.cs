using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Contracts.Interfaces;

/// <summary>
/// Serviço de query para sources.
/// </summary>
public interface ISourceQueryService
{
    /// <summary>
    /// Lista sources com filtros e paginação.
    /// </summary>
    Task<PagedResult<SourceResponse>> ListSourcesAsync(Guid companyId, SourceQuery query, CancellationToken ct = default);
}
