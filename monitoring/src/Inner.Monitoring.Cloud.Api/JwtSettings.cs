namespace Inner.Monitoring.Cloud.Api;

/// <summary>
///     Configurações JWT.
/// </summary>
public class JwtSettings
{
    public string SecretKey { get; set; } = string.Empty;
    public string Issuer { get; set; } = "inner-monitoring";
    public string Audience { get; set; } = "inner-monitoring-api";
}
