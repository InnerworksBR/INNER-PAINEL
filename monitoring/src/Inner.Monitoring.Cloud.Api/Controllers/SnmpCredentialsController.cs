using System.Security.Cryptography;
using System.Text;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para gerenciamento de credenciais SNMP.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/snmp-credentials")]
[Produces("application/json")]
[RequirePortalAuth(PortalRoles.CompanyAdmin, PortalRoles.Operator, PortalRoles.PlatformAdmin)]
public class SnmpCredentialsController : PortalControllerBase
{
    private readonly MonitoringDbContext _db;
    private readonly ILogger<SnmpCredentialsController> _logger;

    public SnmpCredentialsController(
        MonitoringDbContext db,
        ILogger<SnmpCredentialsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Cria uma nova credencial SNMP.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(SnmpCredentialResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCredential(
        [FromRoute] Guid companyId,
        [FromBody] CreateSnmpCredentialRequest request,
        CancellationToken cancellationToken)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        // Validar site
        var site = await _db.Sites
            .FirstOrDefaultAsync(s => s.Id == request.SiteId && s.CompanyId == companyId, cancellationToken);

        if (site == null)
        {
            return BadRequest(new { error = "Site not found" });
        }

        // Criptografar segredo
        var (encryptedSecret, nonce) = EncryptSecret(request.AuthPassword);

        var credential = SnmpCredential.Create(
            companyId,
            request.SiteId,
            request.Name,
            request.Version,
            request.SecurityLevel,
            request.Username,
            request.AuthProtocol,
            request.PrivacyProtocol,
            encryptedSecret,
            nonce);

        _db.SnmpCredentials.Add(credential);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "SNMP credential created: {CredentialId} for company {CompanyId}",
            credential.Id, companyId);

        return CreatedAtAction(nameof(GetCredential), new { companyId, credentialId = credential.Id },
            MapToResponse(credential));
    }

    /// <summary>
    /// Lista credenciais SNMP.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SnmpCredentialResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCredentials(
        [FromRoute] Guid companyId,
        [FromQuery] Guid? site_id,
        CancellationToken cancellationToken = default)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        var query = _db.SnmpCredentials
            .Where(c => c.CompanyId == companyId && c.DeletedAt == null);

        if (site_id.HasValue)
        {
            query = query.Where(c => c.SiteId == site_id.Value);
        }

        var credentials = await query
            .OrderByDescending(c => c.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        return Ok(credentials.Select(MapToResponse).ToList());
    }

    /// <summary>
    /// Obtém detalhes de uma credencial.
    /// </summary>
    [HttpGet("{credentialId:guid}")]
    [ProducesResponseType(typeof(SnmpCredentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCredential(
        [FromRoute] Guid companyId,
        [FromRoute] Guid credentialId,
        CancellationToken cancellationToken)
    {
        var credential = await _db.SnmpCredentials
            .FirstOrDefaultAsync(c => c.Id == credentialId && c.CompanyId == companyId && c.DeletedAt == null, cancellationToken);

        if (credential == null)
        {
            return NotFound(new { error = "Credential not found" });
        }

        return Ok(MapToResponse(credential));
    }

    /// <summary>
    /// Remove (soft delete) uma credencial.
    /// </summary>
    [HttpDelete("{credentialId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCredential(
        [FromRoute] Guid companyId,
        [FromRoute] Guid credentialId,
        CancellationToken cancellationToken)
    {
        var credential = await _db.SnmpCredentials
            .FirstOrDefaultAsync(c => c.Id == credentialId && c.CompanyId == companyId && c.DeletedAt == null, cancellationToken);

        if (credential == null)
        {
            return NotFound(new { error = "Credential not found" });
        }

        credential.MarkDeleted();
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static (string EncryptedSecret, string Nonce) EncryptSecret(string secret)
    {
        // Em produção, usar DPAPI ou Key Vault
        // Por enquanto, apenas base64
        var encrypted = Convert.ToBase64String(Encoding.UTF8.GetBytes(secret));
        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(8));
        return (encrypted, nonce);
    }

    private static SnmpCredentialResponse MapToResponse(SnmpCredential c)
    {
        return new SnmpCredentialResponse(
            Id: c.Id,
            CompanyId: c.CompanyId,
            SiteId: c.SiteId,
            Name: c.Name,
            Version: c.Version,
            SecurityLevel: c.SecurityLevel,
            Username: c.Username,
            AuthProtocol: c.AuthProtocol,
            PrivacyProtocol: c.PrivacyProtocol,
            Status: c.Status,
            Fingerprint: c.Fingerprint,
            CreatedAt: c.CreatedAt,
            RotatedAt: c.RotatedAt);
    }
}
