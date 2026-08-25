using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Inner.Monitoring.Cloud.Api.Jwt;

/// <summary>
///     Serviço para geração e validação de JWTs.
/// </summary>
public class JwtService
{
    private readonly JwtSettings _settings;
    private readonly SymmetricSecurityKey _securityKey;
    private readonly TokenValidationParameters _validationParameters;

    public JwtService(JwtSettings settings)
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
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    }

    /// <summary>
    ///     Gera um access token para uma source.
    /// </summary>
    public string GenerateAccessToken(Guid sourceId, Guid companyId)
    {
        var claims = new[]
        {
            new Claim("source_id", sourceId.ToString()),
            new Claim("company_id", companyId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim(JwtRegisteredClaimNames.Sub, sourceId.ToString())
        };

        var credentials = new SigningCredentials(_securityKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    ///     Valida um access token e retorna os claims principais.
    /// </summary>
    public ClaimsPrincipal? ValidateAccessToken(string token)
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
    ///     Extrai o source_id de um token sem validar (para debug).
    /// </summary>
    public Guid? ExtractSourceId(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            var sourceIdClaim = jwt.Claims.FirstOrDefault(c => c.Type == "source_id");
            if (sourceIdClaim != null && Guid.TryParse(sourceIdClaim.Value, out var sourceId))
            {
                return sourceId;
            }
        }
        catch
        {
            // Ignorar erros de parsing
        }

        return null;
    }
}
