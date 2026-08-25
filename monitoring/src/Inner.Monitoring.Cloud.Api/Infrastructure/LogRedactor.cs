using System.Text.RegularExpressions;

namespace Inner.Monitoring.Cloud.Api.Infrastructure;

/// <summary>
///     Redactor para remover informações sensíveis dos logs.
/// </summary>
public static partial class LogRedactor
{
    // Padrões de dados sensíveis para redacting
    private static readonly Regex PasswordPattern = MyRegex();
    private static readonly Regex JwtPattern = MyRegex2();
    private static readonly Regex AuthorizationPattern = MyRegex3();
    private static readonly Regex IpPattern = MyRegex4();
    private static readonly Regex EmailPattern = MyRegex5();
    private static readonly Regex MacPattern = MyRegex6();
    private static readonly Regex CredentialPattern = MyRegex7();
    private static readonly Regex PrivateKeyPattern = MyRegex8();

    [GeneratedRegex(@"(?i)(password|passwd|pwd|secret|token|apikey|api_key|authorization)[\s]*[=:][\s]*[""']?([^""'\s,;}]+)")]
    private static partial Regex MyRegex();

    [GeneratedRegex(@"(?i)bearer\s+([a-z0-9-_=]+\.[a-z0-9-_=]+\.?[a-z0-9-_=]*\.?[a-z0-9-_=]*)", RegexOptions.IgnoreCase)]
    private static partial Regex MyRegex2();

    [GeneratedRegex(@"(?i)authorization[\s]*[=:][\s]*[""']?(.*?)(?=[""']|$)", RegexOptions.IgnoreCase)]
    private static partial Regex MyRegex3();

    [GeneratedRegex(@"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b")]
    private static partial Regex MyRegex4();

    [GeneratedRegex(@"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b")]
    private static partial Regex MyRegex5();

    [GeneratedRegex(@"([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}")]
    private static partial Regex MyRegex6();

    [GeneratedRegex(@"(?i)(credential|snmp_community|community_string)[\s]*[=:][\s]*[""']?([^""'\s,;}]+)")]
    private static partial Regex MyRegex7();

    [GeneratedRegex(@"-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----")]
    private static partial Regex MyRegex8();

    /// <summary>
    ///     Redact sensitive information from a string.
    /// </summary>
    public static string Redact(string input)
    {
        if (string.IsNullOrEmpty(input))
            return input;

        var result = input;

        // Redact passwords and secrets
        result = PasswordPattern.Replace(result, "$1: [REDACTED]");

        // Redact JWT tokens
        result = JwtPattern.Replace(result, "Bearer [REDACTED]");

        // Redact Authorization headers
        result = AuthorizationPattern.Replace(result, "Authorization: [REDACTED]");

        // Redact credentials
        result = CredentialPattern.Replace(result, "$1: [REDACTED]");

        // Redact private keys
        result = PrivateKeyPattern.Replace(result, "[PRIVATE KEY REDACTED]");

        // Optionally redact IPs and emails in high-security contexts
        // These are commented out as they may be needed for debugging
        // result = IpPattern.Replace(result, "[IP REDACTED]");
        // result = EmailPattern.Replace(result, "[EMAIL REDACTED]");
        // result = MacPattern.Replace(result, "[MAC REDACTED]");

        return result;
    }

    /// <summary>
    ///     Redact sensitive information from a dictionary.
    /// </summary>
    public static Dictionary<string, string> Redact(IDictionary<string, string> input)
    {
        var result = new Dictionary<string, string>();

        foreach (var kvp in input)
        {
            result[kvp.Key] = Redact(kvp.Value);
        }

        return result;
    }

    /// <summary>
    ///     Redact sensitive information from an object.
    /// </summary>
    public static T Redact<T>(T input) where T : class
    {
        if (input == null)
            return input;

        var json = System.Text.Json.JsonSerializer.Serialize(input);
        var redactedJson = Redact(json);
        return System.Text.Json.JsonSerializer.Deserialize<T>(redactedJson) ?? input;
    }
}
