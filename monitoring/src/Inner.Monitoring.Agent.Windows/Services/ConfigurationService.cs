using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Inner.Monitoring.Contracts.Records;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Agent.Windows.Services;

/// <summary>
///     Serviço de gerenciamento de configuração com cache local.
/// </summary>
public sealed class ConfigurationService : IConfigurationService
{
    private readonly IEnrollmentService _enrollmentService;
    private readonly ILogger<ConfigurationService> _logger;
    private readonly string _cachePath;

    private SourceConfiguration? _currentConfiguration;
    private string? _currentETag;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public ConfigurationService(
        IEnrollmentService enrollmentService,
        ILogger<ConfigurationService> logger,
        string dataPath)
    {
        _enrollmentService = enrollmentService;
        _logger = logger;
        _cachePath = Path.Combine(dataPath, "config_cache.json");
    }

    public SourceConfiguration? CurrentConfiguration => _currentConfiguration;
    public long ConfigVersion => _currentConfiguration?.ConfigVersion ?? 0;

    public async Task<(bool Changed, string? ETag)> FetchConfigurationAsync(CancellationToken ct)
    {
        if (!_enrollmentService.IsEnrolled || _enrollmentService.Endpoints == null)
        {
            return (false, null);
        }

        try
        {
            var client = CreateHttpClient();
            var request = new HttpRequestMessage(HttpMethod.Get,
                _enrollmentService.Endpoints.Configuration);

            if (!string.IsNullOrEmpty(_currentETag))
            {
                request.Headers.TryAddWithoutValidation("If-None-Match", _currentETag);
            }

            var response = await client.SendAsync(request, ct);

            if (response.StatusCode == System.Net.HttpStatusCode.NotModified)
            {
                _logger.LogDebug("Configuration not modified");
                return (false, _currentETag);
            }

            response.EnsureSuccessStatusCode();

            var etag = response.Headers.ETag?.Tag?.Trim('"');
            var config = await response.Content.ReadFromJsonAsync<SourceConfiguration>(JsonOptions, ct);

            if (config != null && etag != null)
            {
                await ApplyConfigurationAsync(config, ct);
                _currentETag = etag;
                return (true, etag);
            }

            return (false, _currentETag);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch configuration");
            return (false, _currentETag);
        }
    }

    public async Task SaveLocalConfigurationAsync(SourceConfiguration config, CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(config, JsonOptions);
            var hash = ComputeHash(json);

            var cacheEntry = new ConfigCacheEntry
            {
                Config = config,
                Hash = hash,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            var cacheJson = JsonSerializer.Serialize(cacheEntry, JsonOptions);
            await File.WriteAllTextAsync(_cachePath, cacheJson, ct);

            _logger.LogInformation("Configuration saved locally. Version: {Version}", config.ConfigVersion);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save configuration locally");
        }
    }

    public async Task LoadFromCacheAsync(CancellationToken ct)
    {
        try
        {
            if (!File.Exists(_cachePath))
            {
                _logger.LogDebug("No configuration cache found");
                return;
            }

            var json = await File.ReadAllTextAsync(_cachePath, ct);
            var cacheEntry = JsonSerializer.Deserialize<ConfigCacheEntry>(json, JsonOptions);

            if (cacheEntry?.Config != null)
            {
                _currentConfiguration = cacheEntry.Config;
                _currentETag = cacheEntry.Hash;
                _logger.LogInformation("Configuration loaded from cache. Version: {Version}", _currentConfiguration.ConfigVersion);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load configuration from cache");
        }
    }

    public async Task ApplyConfigurationAsync(SourceConfiguration config, CancellationToken ct)
    {
        _currentConfiguration = config;
        _logger.LogInformation("Configuration applied. Version: {Version}", config.ConfigVersion);

        await SaveLocalConfigurationAsync(config, ct);
    }

    public async Task RollbackAsync(CancellationToken ct)
    {
        _logger.LogWarning("Rolling back configuration");

        // Delete current cache and reload
        if (File.Exists(_cachePath))
        {
            var backupPath = _cachePath + ".backup";
            File.Copy(_cachePath, backupPath, true);
            File.Delete(_cachePath);
        }

        _currentConfiguration = null;
        _currentETag = null;

        await LoadFromCacheAsync(ct);
    }

    private HttpClient CreateHttpClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        var token = _enrollmentService.AccessToken;
        if (!string.IsNullOrEmpty(token))
        {
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }
        return client;
    }

    private static string ComputeHash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private class ConfigCacheEntry
    {
        public SourceConfiguration? Config { get; set; }
        public string? Hash { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
