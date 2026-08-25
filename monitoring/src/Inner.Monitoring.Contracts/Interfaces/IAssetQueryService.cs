using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Contracts.Interfaces;

/// <summary>
/// Serviço de query para assets.
/// </summary>
public interface IAssetQueryService
{
    /// <summary>
    /// Lista assets com filtros e paginação.
    /// </summary>
    Task<PagedResult<AssetSummary>> ListAssetsAsync(AssetQuery query, CancellationToken ct = default);

    /// <summary>
    /// Obtém detalhes de um asset específico.
    /// </summary>
    Task<AssetDetailResponse?> GetAssetDetailAsync(Guid companyId, Guid assetId, CancellationToken ct = default);
}
