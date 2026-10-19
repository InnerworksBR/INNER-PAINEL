using System.Security.Cryptography;
using System.Text;

namespace Inner.Network.Agent.Security;

public interface INetworkSecretStore
{
    void Save(string key, string value);
    string? Read(string key);
    void Delete(string key);
}

public sealed class NetworkSecretStore(string directory) : INetworkSecretStore
{
    public void Save(string key, string value)
    {
        var path = GetPath(key);
        Directory.CreateDirectory(directory);
        var protectedValue = ProtectedData.Protect(Encoding.UTF8.GetBytes(value), null, DataProtectionScope.LocalMachine);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllBytes(temporary, protectedValue);
        File.Move(temporary, path, overwrite: true);
    }

    public string? Read(string key)
    {
        var path = GetPath(key);
        if (!File.Exists(path)) return null;
        return Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.LocalMachine));
    }

    public void Delete(string key)
    {
        var path = GetPath(key);
        if (File.Exists(path)) File.Delete(path);
    }

    private string GetPath(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_'))
            throw new ArgumentException("Secret key must be alphanumeric.", nameof(key));
        return Path.Combine(directory, key + ".bin");
    }
}
