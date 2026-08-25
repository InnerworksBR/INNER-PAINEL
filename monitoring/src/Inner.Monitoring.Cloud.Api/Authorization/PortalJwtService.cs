using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Inner.Monitoring.Cloud.Api.Authorization;

/// <summary>
/// Serviço para gerar e validar JWTs de usuário do portal.
/// </summary>
public class PortalJwtService
{
    private readonly JwtSettings _settings;
    private readonly SymmetricSecurityKey _securityKey;
    private readonly TokenValidationParameters _validationParameters;

    public PortalJwtService(JwtSettings settings)
    {
        _settings = settings;
        _securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SecretKey));

        _validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = _securityKey,
            ValidateIssuer = true,
            ValidIssuer = settings.Issuer,
            ValidateAudience = true,
            ValidAudience = settings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };
    }

    /// <summary>
    /// Gera um JWT para usuário do portal.
    /// </summary>
    public string GenerateUserToken(Guid userId, Guid companyId, string role, string? email = null)
    {
        var claims = new List<Claim>
        {
            new(PortalClaims.UserId, userId.ToString()),
            new(PortalClaims.CompanyId, companyId.ToString()),
            new(PortalClaims.Role, role),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
        };

        if (!string.IsNullOrEmpty(email))
        {
            claims.Add(new Claim(PortalClaims.Email, email));
            claims.Add(new Claim(JwtRegisteredClaimNames.Sub, email));
        }
        else
        {
            claims.Add(new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()));
        }

        var credentials = new SigningCredentials(_securityKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Valida um token e retorna os claims principais.
    /// </summary>
    public ClaimsPrincipal? ValidateToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, _validationParameters, out _);
            return principal;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Extrai o contexto do usuário do token.
    /// </summary>
    public PortalUserContext? ExtractUserContext(string token)
    {
        var principal = ValidateToken(token);
        return principal != null ? new PortalUserContext(principal) : null;
    }
}
