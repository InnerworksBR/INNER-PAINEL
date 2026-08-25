using System.Net.Http.Json;
using System.Runtime.InteropServices;
using System.Text.Json;
using Inner.Monitoring.Agent.Windows.Security;
using Inner.Monitoring.Contracts.Records;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Agent.Windows.Services;

/// <summary>
///     Serviço de enrollment e gerenciamento de tokens.
/// </summary>
public sealed class EnrollmentService : IEnrollmentService
{
    private readonly HttpClient _httpClient;
    private readonly SecureStorage _secureStorage;
    private readonly JwtService _jwtService;
    private readonly ILogger<EnrollmentService> _logger;
    private readonly string _apiBaseUrl;

    private const string KeySourceId = "source_id";
    private const string KeyAccessToken = "access_token";
    private const string KeyRefreshToken = "refresh_token";
    private const string KeyEndpoints = "endpoints";
    private const string KeyAccessTokenExpiry = "access_token_expiry";

    public EnrollmentService(
        HttpClient httpClient,
        SecureStorage secureStorage,
        JwtService jwtService,
        ILogger<EnrollmentService> logger,
        string apiBaseUrl)
    {
        _httpClient = httpClient;
        _secureStorage = secureStorage;
        _jwtService = jwtService;
        _logger = logger;
        _apiBaseUrl = apiBaseUrl;
    }

    public bool IsEnrolled => _secureStorage.Exists(KeySourceId);

    public Guid? SourceId
    {
        get
        {
            var idStr = _secureStorage.Get(KeySourceId);
            return Guid.TryParse(idStr, out var id) ? id : null;
        }
    }

    public string? AccessToken => _secureStorage.Get(KeyAccessToken);

    public SourceEndpoints? Endpoints
    {
        get
        {
            var json = _secureStorage.Get(KeyEndpoints);
            return json != null
                ? JsonSerializer.Deserialize<SourceEndpoints>(json)
                : null;
        }
    }

    public async Task<SourceRegistrationResponse> EnrollAsync(string activationToken, CancellationToken ct)
    {
        _logger.LogInformation("Starting enrollment with activation token");

        var request = new SourceRegistrationRequest(
            ActivationToken: activationToken,
            SourceType: "agent",
            InstallationId: GetInstallationId(),
            DisplayName: Environment.MachineName,
            Platform: "windows",
            Architecture: RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant(),
            SourceVersion: "1.0.0",
            Hostname: Environment.MachineName,
            Fingerprint: GetMachineFingerprint(),
            Capabilities: new SourceCapabilities(
                HostMetrics: true,
                HyperV: false,
                SnmpV2c: false,
                SnmpV3: false));

        var response = await _httpClient.PostAsJsonAsync(
            $"{_apiBaseUrl}/api/sources/register",
            request,
            ct);

        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SourceRegistrationResponse>(ct);

        if (result == null)
            throw new InvalidOperationException("Invalid enrollment response");

        // Store credentials securely
        _secureStorage.Save(KeySourceId, result.SourceId.ToString());
        _secureStorage.Save(KeyAccessToken, result.AccessToken);
        _secureStorage.Save(KeyRefreshToken, result.RefreshToken);
        _secureStorage.Save(KeyAccessTokenExpiry, result.AccessTokenExpiresAt.ToString("O"));

        var endpointsJson = JsonSerializer.Serialize(result.Endpoints);
        _secureStorage.Save(KeyEndpoints, endpointsJson);

        _logger.LogInformation("Enrollment successful. SourceId: {SourceId}", result.SourceId);

        return result;
    }

    public async Task<TokenRefreshResponse> RefreshTokensAsync(CancellationToken ct)
    {
        var sourceId = SourceId;
        var refreshToken = _secureStorage.Get(KeyRefreshToken);

        if (sourceId == null || refreshToken == null)
            throw new InvalidOperationException("Not enrolled or missing refresh token");

        _logger.LogInformation("Refreshing tokens for source {SourceId}", sourceId);

        var request = new TokenRefreshRequest(sourceId.Value, refreshToken);

        var response = await _httpClient.PostAsJsonAsync(
            $"{_apiBaseUrl}/api/sources/refresh",
            request,
            ct);

        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<TokenRefreshResponse>(ct);

        if (result == null)
            throw new InvalidOperationException("Invalid refresh response");

        // Update stored tokens
        _secureStorage.Save(KeyAccessToken, result.AccessToken);
        _secureStorage.Save(KeyRefreshToken, result.RefreshToken);
        _secureStorage.Save(KeyAccessTokenExpiry, result.AccessTokenExpiresAt.ToString("O"));

        _logger.LogInformation("Token refresh successful");

        return result;
    }

    public async Task<bool> EnsureValidTokenAsync(CancellationToken ct)
    {
        var token = AccessToken;
        if (token == null)
            return false;

        // Check if token is expiring soon (within 5 minutes)
        if (!_jwtService.IsExpiringSoon(token, TimeSpan.FromMinutes(5)))
            return true;

        try
        {
            await RefreshTokensAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to refresh token");
            return false;
        }
    }

    public void ClearEnrollment()
    {
        _secureStorage.Delete(KeySourceId);
        _secureStorage.Delete(KeyAccessToken);
        _secureStorage.Delete(KeyRefreshToken);
        _secureStorage.Delete(KeyEndpoints);
        _secureStorage.Delete(KeyAccessTokenExpiry);

        _logger.LogInformation("Enrollment cleared");
    }

    private static Guid GetInstallationId()
    {
        var path = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "InnerWorks",
            "MonitoringAgent",
            "installation_id");

        if (File.Exists(path))
        {
            var content = File.ReadAllText(path);
            if (Guid.TryParse(content.Trim(), out var id))
                return id;
        }

        var newId = Guid.NewGuid();
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, newId.ToString());
        return newId;
    }

    private static MachineFingerprint GetMachineFingerprint()
    {
        var smbiosUuid = GetSmbiosUuid();
        var machineIdHash = GetMachineIdHash();

        return new MachineFingerprint(
            SmbiosUuid: smbiosUuid,
            MachineIdHash: machineIdHash);
    }

    private static string? GetSmbiosUuid()
    {
        try
        {
            var searcher = new System.Management.ManagementObjectSearcher(
                "SELECT UUID FROM Win32_ComputerSystemProduct");
            foreach (var obj in searcher.Get())
            {
                var uuid = obj["UUID"]?.ToString();
                if (!string.IsNullOrEmpty(uuid) && uuid != "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")
                    return uuid;
            }
        }
        catch { }
        return null;
    }

    private static string? GetMachineIdHash()
    {
        try
        {
            var machineId = Microsoft.Win32.Registry.LocalMachine
                .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography")
                ?.GetValue("MachineGuid")?.ToString();

            if (!string.IsNullOrEmpty(machineId))
            {
                using var sha256 = System.Security.Cryptography.SHA256.Create();
                var hash = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(machineId));
                return Convert.ToHexString(hash).ToLowerInvariant();
            }
        }
        catch { }
        return null;
    }
}
