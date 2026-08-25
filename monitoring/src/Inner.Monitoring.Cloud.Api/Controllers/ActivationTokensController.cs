using System.Security.Cryptography;
using System.Text;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para gerenciamento de tokens de ativação.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/activation-tokens")]
[Produces("application/json")]
[RequirePortalAuth(PortalRoles.CompanyAdmin, PortalRoles.PlatformAdmin)]
public class ActivationTokensController : PortalControllerBase
{
    private readonly MonitoringDbContext _db;
    private readonly ILogger<ActivationTokensController> _logger;

    public ActivationTokensController(
        MonitoringDbContext db,
        ILogger<ActivationTokensController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Cria um novo token de ativação.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ActivationTokenResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateToken(
        [FromRoute] Guid companyId,
        [FromBody] CreateActivationTokenRequest request,
        CancellationToken cancellationToken)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        // Validar site existe
        var site = await _db.Sites
            .FirstOrDefaultAsync(s => s.Id == request.SiteId && s.CompanyId == companyId, cancellationToken);

        if (site == null)
        {
            return BadRequest(new { error = "Site not found" });
        }

        // Parse source type
        if (!Enum.TryParse<SourceType>(request.SourceType, true, out var sourceType))
        {
            return BadRequest(new { error = "Invalid source type" });
        }

        // Gerar token
        var plainToken = GenerateToken();
        var tokenHash = ComputeTokenHash(plainToken);
        var validityMinutes = request.ValidityMinutes ?? 60;
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(validityMinutes);

        var token = ActivationToken.Create(
            companyId,
            request.SiteId,
            sourceType,
            tokenHash,
            request.DisplayHint);

        token.UpdateExpiry(expiresAt);

        _db.ActivationTokens.Add(token);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Activation token created: {TokenId} for company {CompanyId}",
            token.Id, companyId);

        // Retornar com preview do token (apenas uma vez)
        return CreatedAtAction(nameof(GetToken), new { companyId, tokenId = token.Id },
            new ActivationTokenResponse(
                Id: token.Id,
                DisplayHint: token.DisplayHint ?? "",
                TokenPreview: plainToken[..8] + "...",
                ExpiresAt: expiresAt,
                CompanyId: token.CompanyId,
                SiteId: token.SiteId ?? Guid.Empty,
                SourceType: token.SourceType.ToString(),
                CreatedAt: token.CreatedAt,
                UsedAt: token.UsedAt,
                Token: plainToken));
    }

    /// <summary>
    /// Lista tokens de ativação.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ActivationTokenResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTokens(
        [FromRoute] Guid companyId,
        [FromQuery] bool? active_only = true,
        CancellationToken cancellationToken = default)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        var query = _db.ActivationTokens
            .Where(t => t.CompanyId == companyId);

        if (active_only == true)
        {
            query = query.Where(t => t.UsedAt == null && t.RevokedAt == null && t.ExpiresAt > DateTimeOffset.UtcNow);
        }

        var tokens = await query
            .OrderByDescending(t => t.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        var response = tokens.Select(t => new ActivationTokenResponse(
            Id: t.Id,
            DisplayHint: t.DisplayHint ?? "",
            TokenPreview: null,
            ExpiresAt: t.ExpiresAt,
            CompanyId: t.CompanyId,
            SiteId: t.SiteId ?? Guid.Empty,
            SourceType: t.SourceType.ToString(),
            CreatedAt: t.CreatedAt,
            UsedAt: t.UsedAt)).ToList();

        return Ok(response);
    }

    /// <summary>
    /// Obtém detalhes de um token.
    /// </summary>
    [HttpGet("{tokenId:guid}")]
    [ProducesResponseType(typeof(ActivationTokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetToken(
        [FromRoute] Guid companyId,
        [FromRoute] Guid tokenId,
        CancellationToken cancellationToken)
    {
        var token = await _db.ActivationTokens
            .FirstOrDefaultAsync(t => t.Id == tokenId && t.CompanyId == companyId, cancellationToken);

        if (token == null)
        {
            return NotFound(new { error = "Token not found" });
        }

        return Ok(new ActivationTokenResponse(
            Id: token.Id,
            DisplayHint: token.DisplayHint ?? "",
            TokenPreview: null,
            ExpiresAt: token.ExpiresAt,
            CompanyId: token.CompanyId,
            SiteId: token.SiteId ?? Guid.Empty,
            SourceType: token.SourceType.ToString(),
            CreatedAt: token.CreatedAt,
            UsedAt: token.UsedAt));
    }

    /// <summary>
    /// Revoga um token.
    /// </summary>
    [HttpDelete("{tokenId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeToken(
        [FromRoute] Guid companyId,
        [FromRoute] Guid tokenId,
        CancellationToken cancellationToken)
    {
        var token = await _db.ActivationTokens
            .FirstOrDefaultAsync(t => t.Id == tokenId && t.CompanyId == companyId, cancellationToken);

        if (token == null)
        {
            return NotFound(new { error = "Token not found" });
        }

        token.Revoke();
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static string ComputeTokenHash(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}
