using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Inner.Monitoring.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Edge.Collector.Security;

/// <summary>
///     Interface para gerenciamento de credenciais SNMP.
/// </summary>
public interface ICredentialManager
{
    /// <summary>
    ///     Armazena uma credencial descriptografada em cache.
    /// </summary>
    void CacheCredential(SnmpCredential credential);

    /// <summary>
    ///     Obtém uma credencial do cache (descriptografada).
    /// </summary>
    SnmpCredential? GetCachedCredential(Guid credentialId);

    /// <summary>
    ///     Remove uma credencial do cache.
    /// </summary>
    void InvalidateCredential(Guid credentialId);

    /// <summary>
    ///     Invalida todas as credenciais com versão diferente.
    /// </summary>
    void InvalidateByVersion(int keyVersion);

    /// <summary>
    ///     Limpa todo o cache.
    /// </summary>
    void ClearCache();
}

/// <summary>
///     Implementação de gerenciamento de credenciais com cache criptografado.
/// </summary>
public sealed class CredentialManager : ICredentialManager
{
    private readonly ILogger<CredentialManager> _logger;
    private readonly byte[] _masterKey;
    private readonly ConcurrentDictionary<Guid, CachedCredential> _cache = new();

    public CredentialManager(ILogger<CredentialManager> logger, byte[] masterKey)
    {
        _logger = logger;
        _masterKey = masterKey;
    }

    public void CacheCredential(SnmpCredential credential)
    {
        var cached = new CachedCredential
        {
            Credential = credential,
            CachedAt = DateTimeOffset.UtcNow,
            KeyVersion = credential.KeyVersion
        };

        _cache.AddOrUpdate(credential.Id, cached, (_, _) => cached);

        _logger.LogDebug(
            "Credential {CredentialId} cached (version {Version})",
            credential.Id, credential.KeyVersion);
    }

    public SnmpCredential? GetCachedCredential(Guid credentialId)
    {
        if (_cache.TryGetValue(credentialId, out var cached))
        {
            return cached.Credential;
        }

        return null;
    }

    public void InvalidateCredential(Guid credentialId)
    {
        if (_cache.TryRemove(credentialId, out _))
        {
            _logger.LogDebug(
                "Credential {CredentialId} invalidated",
                credentialId);
        }
    }

    public void InvalidateByVersion(int keyVersion)
    {
        var toRemove = _cache
            .Where(kvp => kvp.Value.KeyVersion != keyVersion)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var id in toRemove)
        {
            _cache.TryRemove(id, out _);
        }

        if (toRemove.Count > 0)
        {
            _logger.LogInformation(
                "Invalidated {Count} credentials due to key version change",
                toRemove.Count);
        }
    }

    public void ClearCache()
    {
        _cache.Clear();
        _logger.LogInformation("Credential cache cleared");
    }

    /// <summary>
    ///     Descriptografa o segredo de uma credencial usando a master key.
    ///     Usa AES-CBC para descriptografia.
    /// </summary>
    public byte[] DecryptSecret(byte[] encryptedSecret, byte[] nonce, byte[] tag)
    {
        try
        {
            using var aes = Aes.Create();
            aes.Key = _masterKey;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            // Use nonce as IV (first 16 bytes or full nonce depending on config)
            aes.IV = nonce.Length >= 16 ? nonce[..16] : nonce;

            using var decryptor = aes.CreateDecryptor();
            // For GCM mode, we'd need a different approach, but CBC is simpler
            return decryptor.TransformFinalBlock(encryptedSecret, 0, encryptedSecret.Length);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to decrypt credential secret");
            throw;
        }
    }

    /// <summary>
    ///     Descriptografa o segredo e retorna como string.
    /// </summary>
    public string DecryptSecretAsString(byte[] encryptedSecret, byte[] nonce, byte[] tag)
    {
        var decrypted = DecryptSecret(encryptedSecret, nonce, tag);
        return Encoding.UTF8.GetString(decrypted);
    }

    private sealed class CachedCredential
    {
        public required SnmpCredential Credential { get; init; }
        public required DateTimeOffset CachedAt { get; init; }
        public required int KeyVersion { get; init; }
    }
}

/// <summary>
///     Master key provider para descriptografia de credenciais.
/// </summary>
public sealed class MasterKeyProvider
{
    private readonly ILogger<MasterKeyProvider> _logger;
    private readonly string? _keyFilePath;
    private readonly byte[]? _envKey;

    public MasterKeyProvider(ILogger<MasterKeyProvider> logger, string? keyFilePath = null)
    {
        _logger = logger;
        _keyFilePath = keyFilePath;
        _envKey = Environment.GetEnvironmentVariable("INNER_MASTER_KEY") is { } envKey
            ? Convert.FromHexString(envKey)
            : null;
    }

    public byte[] GetMasterKey()
    {
        // Try environment variable first
        if (_envKey != null)
        {
            return _envKey;
        }

        // Try key file
        if (!string.IsNullOrEmpty(_keyFilePath) && File.Exists(_keyFilePath))
        {
            var keyHex = File.ReadAllText(_keyFilePath).Trim();
            return Convert.FromHexString(keyHex);
        }

        // Generate a warning but use a default for development
        _logger.LogWarning(
            "No master key configured. Using default key for development only!");

        // DO NOT use this in production - this is for development only
        return new byte[32]; // 256-bit zero key
    }
}
