using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Inner.Monitoring.Agent.Windows.Security;

/// <summary>
///     Geração e validação de JWT tokens.
/// </summary>
public sealed class JwtService
{
    private readonly string _signingKey;

    public JwtService(string signingKey)
    {
        _signingKey = signingKey;
    }

    /// <summary>
    ///     Valida um JWT token e retorna os claims.
    /// </summary>
    public ClaimsPrincipal? ValidateToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_signingKey);

        try
        {
            var principal = tokenHandler.ValidateToken(token, new Microsoft.IdentityModel.Tokens.TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(5)
            }, out _);

            return principal;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    ///     Verifica se o token está próximo de expirar.
    /// </summary>
    public bool IsExpiringSoon(string token, TimeSpan threshold)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var jwt = handler.ReadJwtToken(token);
            var expires = jwt.ValidTo;
            var refreshBefore = DateTime.UtcNow.Add(threshold);

            // Tokens that have already expired must also be refreshed. The old
            // condition returned false for them, so the agent kept sending an
            // expired access token and received 401 indefinitely.
            return expires <= refreshBefore;
        }
        catch
        {
            return true;
        }
    }

    /// <summary>
    ///     Extrai o SourceId do token.
    /// </summary>
    public Guid? GetSourceId(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var jwt = handler.ReadJwtToken(token);
            var sub = jwt.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }
        catch
        {
            return null;
        }
    }
}
