using System.Security.Cryptography;
using System.Text;

namespace Inner.Agent.Windows;

public static class MachineIdentity
{
    public static string GetCurrent()
    {
        var machineGuid = string.Empty;
        if (OperatingSystem.IsWindows())
        {
            try
            {
                machineGuid = Microsoft.Win32.Registry.LocalMachine
                    .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography")
                    ?.GetValue("MachineGuid")?.ToString() ?? string.Empty;
            }
            catch
            {
                // Fallback below keeps the agent identifiable if registry access is restricted.
            }
        }

        return Create(machineGuid, Environment.MachineName);
    }

    public static string Create(string machineGuid, string hostname)
    {
        var input = $"{machineGuid.Trim()}\n{hostname.Trim().ToUpperInvariant()}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
    }
}
