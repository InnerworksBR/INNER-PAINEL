using System.Text.Json;
using System.Text.Json.Serialization;

namespace Inner.Network.Agent.Setup;

public sealed record PairingStatusDocument(
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("code")] string? Code,
    [property: JsonPropertyName("expires_at")] DateTimeOffset? ExpiresAt,
    [property: JsonPropertyName("verification_url")] string? VerificationUrl);

public static class InstallerPackageSafety
{
    public static bool IsSafeEntry(string destination, string entryName)
    {
        var root = Path.GetFullPath(destination).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var target = Path.GetFullPath(Path.Combine(destination, entryName));
        return target.StartsWith(root, StringComparison.OrdinalIgnoreCase);
    }

    public static PairingStatusDocument? ParseStatus(string json) =>
        JsonSerializer.Deserialize<PairingStatusDocument>(json);
}
