using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Contracts.Interfaces;

/// <summary>
/// Serviço de query para cockpit operacional.
/// </summary>
public interface ICockpitQueryService
{
    /// <summary>
    /// Obtém o resumo do cockpit para uma empresa.
    /// </summary>
    Task<CockpitResponse> GetCockpitAsync(Guid companyId, CancellationToken ct = default);
}
