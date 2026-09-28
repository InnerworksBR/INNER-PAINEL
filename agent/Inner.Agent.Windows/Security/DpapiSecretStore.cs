using System.Security.Cryptography;
using System.Text;

namespace Inner.Agent.Windows.Security;

public sealed class DpapiSecretStore
{
    private readonly string _directory;

    public DpapiSecretStore(string directory)
    {
        _directory = directory;
        Directory.CreateDirectory(directory);
    }

    public void Save(string key, string value)
    {
        var protectedBytes = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(value),
            optionalEntropy: null,
            scope: DataProtectionScope.LocalMachine);
        var target = GetPath(key);
        var temporary = $"{target}.{Guid.NewGuid():N}.tmp";
        File.WriteAllBytes(temporary, protectedBytes);
        File.Move(temporary, target, overwrite: true);
    }

    public string? Read(string key)
    {
        var path = GetPath(key);
        if (!File.Exists(path)) return null;
        var protectedBytes = File.ReadAllBytes(path);
        var plainBytes = ProtectedData.Unprotect(
            protectedBytes,
            optionalEntropy: null,
            scope: DataProtectionScope.LocalMachine);
        return Encoding.UTF8.GetString(plainBytes);
    }

    public bool Exists(string key) => File.Exists(GetPath(key));

    public void Delete(string key)
    {
        var path = GetPath(key);
        if (File.Exists(path)) File.Delete(path);
    }

    private string GetPath(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
            throw new ArgumentException("Invalid secret key.", nameof(key));
        return Path.Combine(_directory, $"{key}.bin");
    }
}
