using System.Security.Cryptography;
using System.Text;

namespace Inner.Monitoring.Agent.Windows.Security;

/// <summary>
///     Armazenamento seguro usando DPAPI.
/// </summary>
public sealed class SecureStorage
{
    private readonly string _secretsPath;

    public SecureStorage(string dataPath)
    {
        _secretsPath = Path.Combine(dataPath, "secrets");
        Directory.CreateDirectory(_secretsPath);
    }

    /// <summary>
    ///     Salva um segredo protegido por DPAPI.
    /// </summary>
    public void Save(string key, string value)
    {
        var filePath = GetFilePath(key);
        var encrypted = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(value),
            null,
            DataProtectionScope.CurrentUser);
        File.WriteAllBytes(filePath, encrypted);
    }

    /// <summary>
    ///     Recupera um segredo desprotegido.
    /// </summary>
    public string? Get(string key)
    {
        var filePath = GetFilePath(key);
        if (!File.Exists(filePath))
            return null;

        try
        {
            var encrypted = File.ReadAllBytes(filePath);
            var decrypted = ProtectedData.Unprotect(
                encrypted,
                null,
                DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    ///     Remove um segredo.
    /// </summary>
    public void Delete(string key)
    {
        var filePath = GetFilePath(key);
        if (File.Exists(filePath))
            File.Delete(filePath);
    }

    /// <summary>
    ///     Verifica se uma chave existe.
    /// </summary>
    public bool Exists(string key) => File.Exists(GetFilePath(key));

    private string GetFilePath(string key)
    {
        var safeKey = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(key)))
            .Replace("/", "_")
            .Replace("+", "-");
        return Path.Combine(_secretsPath, $"{safeKey}.secret");
    }
}
