using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Contracts.Interfaces;

/// <summary>
/// Serviço de query para eventos.
/// </summary>
public interface IEventQueryService
{
    /// <summary>
    /// Lista eventos com filtros e paginação.
    /// </summary>
    Task<PagedResult<EventResponse>> ListEventsAsync(Guid companyId, EventQuery query, CancellationToken ct = default);

    /// <summary>
    /// Obtém eventos recentes para um asset.
    /// </summary>
    Task<IReadOnlyList<EventResponse>> GetRecentEventsForAssetAsync(
        Guid companyId,
        Guid assetId,
        int limit = 10,
        CancellationToken ct = default);
}
