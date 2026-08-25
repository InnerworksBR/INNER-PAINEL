using Inner.Monitoring.Application.QueryServices;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para o cockpit operacional.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/cockpit")]
[Produces("application/json")]
[RequirePortalAuth]
public class CockpitController : PortalControllerBase
{
    private readonly ICockpitQueryService _cockpitService;
    private readonly ILogger<CockpitController> _logger;

    public CockpitController(
        ICockpitQueryService cockpitService,
        ILogger<CockpitController> logger)
    {
        _cockpitService = cockpitService;
        _logger = logger;
    }

    /// <summary>
    /// Obtém o resumo do cockpit operacional.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(CockpitResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetCockpit(
        [FromRoute] Guid companyId,
        CancellationToken cancellationToken)
    {
        // company_id do token, nunca do request
        var tokenCompanyId = GetCompanyId();

        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            _logger.LogWarning(
                "Tentativa de acesso a cockpit de empresa diferente: token={TokenCompany}, requested={Requested}",
                tokenCompanyId, companyId);
            return Forbid();
        }

        var cockpit = await _cockpitService.GetCockpitAsync(companyId, cancellationToken);

        return Ok(cockpit);
    }
}
