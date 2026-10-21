using System.Diagnostics;
using System.IO.Compression;
using System.ServiceProcess;
using System.Text.Json;
using System.Security.Principal;
using Microsoft.Win32;

namespace Inner.Network.Agent.Setup;

internal sealed record InstallResult(string State, string? PairingCode, DateTimeOffset? ExpiresAt, string? VerificationUrl);
internal static class AgentInstaller
{
    private const string ServiceName = "InnerNetworkAgent";
    private const string ServiceDisplayName = "Inner Network Agent";
    private const string InstallRoot = @"C:\Program Files\InnerWorks\NetworkAgent";
    private const string DataDirectory = @"C:\ProgramData\InnerWorks\NetworkAgent";
    private const string PackageResourceName = "Inner.Network.Agent.Setup.AgentPackage.zip";

    public static InstallResult Install(Action<string> reportProgress)
    {
        if (!OperatingSystem.IsWindows() || !Environment.Is64BitOperatingSystem)
            throw new InvalidOperationException("Este instalador requer Windows x64.");

        Directory.CreateDirectory(DataDirectory);
        var stage = Path.Combine(Path.GetTempPath(), $"inner-network-agent-setup-{Guid.NewGuid():N}");
        Directory.CreateDirectory(stage);
        ServiceController? existing = null;
        var wasRunning = false;
        try
        {
            reportProgress("Extraindo o serviço...");
            ExtractEmbeddedPackage(stage);
            var executable = Path.Combine(stage, "Inner.Network.Agent.exe");
            var config = Path.Combine(stage, "appsettings.json");
            if (!File.Exists(executable) || !File.Exists(config))
                throw new InvalidOperationException("O pacote incorporado está incompleto.");

            existing = TryGetService();
            if (existing is not null)
            {
                wasRunning = existing.Status != ServiceControllerStatus.Stopped;
                if (existing.Status == ServiceControllerStatus.StopPending)
                    existing.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(30));
                else if (existing.Status != ServiceControllerStatus.Stopped)
                {
                    reportProgress("Parando o serviço atual...");
                    existing.Stop();
                    existing.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(30));
                }
            }

            SetDirectoryAcl(DataDirectory);
            reportProgress("Instalando os arquivos do agente...");
            Directory.CreateDirectory(InstallRoot);
            CopyDirectory(stage, InstallRoot);
            reportProgress("Configurando o serviço do Windows...");
            ConfigureService(Path.Combine(InstallRoot, "Inner.Network.Agent.exe"), existing is not null);
            reportProgress("Iniciando o serviço e solicitando o código de vínculo...");
            using (var service = new ServiceController(ServiceName))
            {
                service.Start();
                service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
            }
            return WaitForPairingStatus(reportProgress, TimeSpan.FromSeconds(90));
        }
        catch
        {
            if (wasRunning) TryStartService();
            throw;
        }
        finally
        {
            existing?.Dispose();
            SafeDeleteStage(stage);
        }
    }

    private static InstallResult WaitForPairingStatus(Action<string> report, TimeSpan wait)
    {
        var statusPath = Path.Combine(DataDirectory, "pairing-status.json");
        var until = DateTimeOffset.UtcNow + wait;
        while (DateTimeOffset.UtcNow < until)
        {
            if (File.Exists(statusPath))
            {
                try
                {
                    var status = InstallerPackageSafety.ParseStatus(File.ReadAllText(statusPath));
                    if (status is not null &&
                        (status.State == "completed" ||
                         (status.State == "pending" && !string.IsNullOrWhiteSpace(status.Code) && status.ExpiresAt > DateTimeOffset.UtcNow)))
                        return new(status.State, status.Code, status.ExpiresAt, status.VerificationUrl);
                }
                catch (JsonException) { }
            }
            report("Serviço iniciado. Aguardando conexão com o Portal Inner para emitir o código...");
            Thread.Sleep(TimeSpan.FromSeconds(2));
        }
        return new("waiting_for_internet", null, null, null);
    }

    private static void ExtractEmbeddedPackage(string destination)
    {
        using var stream = typeof(AgentInstaller).Assembly.GetManifestResourceStream(PackageResourceName)
            ?? throw new InvalidOperationException("O pacote do serviço não foi incorporado ao instalador.");
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        foreach (var entry in archive.Entries)
        {
            if (!InstallerPackageSafety.IsSafeEntry(destination, entry.FullName))
                throw new InvalidOperationException("O pacote contém um caminho de extração inválido.");
            var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
            if (entry.FullName.EndsWith('/')) { Directory.CreateDirectory(target); continue; }
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            using var input = entry.Open();
            using var output = File.Create(target);
            input.CopyTo(output);
        }
    }

    private static void ConfigureService(string executablePath, bool exists)
    {
        var command = exists ? "config" : "create";
        RunTool(SystemTool("sc.exe"), command, ServiceName, "binPath=", $"\"{executablePath}\"", "start=", "auto", "obj=", "LocalSystem", "DisplayName=", ServiceDisplayName);
        RunTool(SystemTool("sc.exe"), "description", ServiceName, "Coleta SNMP de redes autorizadas e envia telemetria ao Portal Inner.");
    }

    private static ServiceController? TryGetService()
    {
        using var key = Registry.LocalMachine.OpenSubKey($@"SYSTEM\CurrentControlSet\Services\{ServiceName}");
        if (key is null) return null;
        var service = new ServiceController(ServiceName);
        _ = service.Status;
        return service;
    }

    private static void TryStartService()
    {
        try
        {
            using var service = new ServiceController(ServiceName);
            if (service.Status == ServiceControllerStatus.Stopped) service.Start();
        }
        catch { }
    }

    private static void CopyDirectory(string source, string destination)
    {
        foreach (var directory in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
            Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, directory)));
        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(source, file);
            var target = Path.Combine(destination, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, overwrite: true);
        }
    }

    private static void SetDirectoryAcl(string path) => InstallerAclPolicy.Apply(
        path,
        [
            new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
            new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null)
        ],
        RecoverDataPathOwnership);

    private static void RecoverDataPathOwnership(string path)
    {
        var fullPath = Path.GetFullPath(path);
        var dataRoot = Path.GetFullPath(DataDirectory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var dataPrefix = dataRoot + Path.DirectorySeparatorChar;
        if (!fullPath.Equals(dataRoot, StringComparison.OrdinalIgnoreCase) &&
            !fullPath.StartsWith(dataPrefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Recusa de alterar ownership fora da pasta de dados do agente.");

        InstallerAclPolicy.EnsurePathHasNoReparsePoints(fullPath);
        RunTool(SystemTool("takeown.exe"), "/F", fullPath, "/A");
    }
    private static string SystemTool(string name) => Path.Combine(Environment.SystemDirectory, name);
    private static void RunTool(string file, params string[] arguments)
    {
        var start = new ProcessStartInfo(file) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        using var process = Process.Start(start) ?? throw new InvalidOperationException($"Não foi possível iniciar {Path.GetFileName(file)}.");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        process.WaitForExit();
        Task.WaitAll(stdout, stderr);
        if (process.ExitCode != 0) throw new InvalidOperationException($"Falha em {Path.GetFileName(file)}: {stderr.Result} {stdout.Result}".Trim());
    }

    private static void SafeDeleteStage(string path)
    {
        var target = Path.GetFullPath(path);
        var temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!target.StartsWith(temp, StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(target).StartsWith("inner-network-agent-setup-", StringComparison.Ordinal))
            throw new InvalidOperationException("Refusing to remove an unexpected staging path.");
        if (Directory.Exists(target)) Directory.Delete(target, recursive: true);
    }
}
