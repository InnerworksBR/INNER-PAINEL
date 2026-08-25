using System.Text.Json;
using Inner.Monitoring.Agent.Windows;
using Inner.Monitoring.Agent.Windows.Collectors;
using Inner.Monitoring.Agent.Windows.Commands;
using Inner.Monitoring.Agent.Windows.Outbox;
using Inner.Monitoring.Agent.Windows.Security;
using Inner.Monitoring.Agent.Windows.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Events;

namespace Inner.Monitoring.Agent.Windows;

// Paths
file static class Paths
{
    public static string ProgramDataPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "InnerWorks",
        "MonitoringAgent");

    public static string ConfigPath => Path.Combine(ProgramDataPath, "config");
    public static string DataPath => Path.Combine(ProgramDataPath, "data");
    public static string LogsPath => Path.Combine(ProgramDataPath, "logs");
}

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        // Parse command line arguments
        if (args.Length > 0)
        {
            return args[0].ToLowerInvariant() switch
            {
                "install" => await InstallServiceAsync(),
                "uninstall" => UninstallService(),
                "run" => RunConsoleAsync(args).Result,
                _ => RunConsoleAsync(args).Result
            };
        }

        // Run as Windows Service or Console
        return await RunHostAsync(args);
    }

    private static async Task<int> RunHostAsync(string[] args)
    {
        var host = CreateHostBuilder(args);

        // Ensure directories exist
        Directory.CreateDirectory(Paths.ConfigPath);
        Directory.CreateDirectory(Paths.DataPath);
        Directory.CreateDirectory(Paths.LogsPath);

        // Configure Serilog
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .WriteTo.File(
                Path.Combine(Paths.LogsPath, "agent-.log"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
            .CreateLogger();

        try
        {
            Log.Information("Starting Inner Monitoring Agent");

            // Initialize outbox
            using (var scope = host.Services.CreateScope())
            {
                var outbox = scope.ServiceProvider.GetRequiredService<SqliteOutbox>();
                await outbox.InitializeAsync(CancellationToken.None);
            }

            await host.RunAsync();
            return 0;
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Agent terminated unexpectedly");
            return 1;
        }
        finally
        {
            await Log.CloseAndFlushAsync();
        }
    }

    private static async Task<int> RunConsoleAsync(string[] args)
    {
        Console.WriteLine("Inner Monitoring Agent - Console Mode");
        Console.WriteLine("======================================");
        Console.WriteLine($"Program Data: {Paths.ProgramDataPath}");
        Console.WriteLine($"Logs: {Paths.LogsPath}");
        Console.WriteLine();

        return await RunHostAsync(args);
    }

    private static async Task<int> InstallServiceAsync()
    {
        Console.WriteLine("Installing Inner Monitoring Agent as Windows Service...");

        try
        {
            // Create bootstrap config if needed
            var bootstrapPath = Path.Combine(Paths.ConfigPath, "bootstrap.json");
            if (!File.Exists(bootstrapPath))
            {
                var bootstrap = new
                {
                    api_base_url = "https://api.innerworks.com.br",
                    heartbeat_interval_seconds = 60,
                    collection_interval_seconds = 15
                };
                await File.WriteAllTextAsync(bootstrapPath, JsonSerializer.Serialize(bootstrap, new JsonSerializerOptions { WriteIndented = true }));
            }

            // Use sc.exe to create the service
            var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(exePath))
            {
                Console.WriteLine("Error: Could not determine executable path");
                return 1;
            }

            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = $"create \"Inner Monitoring Agent\" binPath= \"\\\"{exePath}\\\"\" start= auto DisplayName= \"Inner Monitoring Agent\"",
                UseShellExecute = false,
                CreateNoWindow = true
            };

            var process = System.Diagnostics.Process.Start(psi);
            process?.WaitForExit();

            // Configure recovery actions
            var recoveryPsi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = "failure \"Inner Monitoring Agent\" reset= 86400 actions= restart/60000/restart/60000/restart/60000",
                UseShellExecute = false,
                CreateNoWindow = true
            };

            var recoveryProcess = System.Diagnostics.Process.Start(recoveryPsi);
            recoveryProcess?.WaitForExit();

            Console.WriteLine("Service installed successfully");
            Console.WriteLine();
            Console.WriteLine("To start the service, run: sc start \"Inner Monitoring Agent\"");

            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Installation failed: {ex.Message}");
            return 1;
        }
    }

    private static int UninstallService()
    {
        Console.WriteLine("Uninstalling Inner Monitoring Agent...");

        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = "stop \"Inner Monitoring Agent\"",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            var stopProcess = System.Diagnostics.Process.Start(psi);
            stopProcess?.WaitForExit();

            System.Threading.Thread.Sleep(2000);

            psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = "delete \"Inner Monitoring Agent\"",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            var deleteProcess = System.Diagnostics.Process.Start(psi);
            deleteProcess?.WaitForExit();

            Console.WriteLine("Service uninstalled successfully");
            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Uninstallation failed: {ex.Message}");
            return 1;
        }
    }

    private static IHost CreateHostBuilder(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);

        // Configure Serilog
        builder.Services.AddSerilog((services, lc) => lc
            .MinimumLevel.Debug()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
            .Enrich.FromLogContext()
            .WriteTo.File(
                Path.Combine(Paths.LogsPath, "agent-.log"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj}{NewLine}{Exception}"));

        builder.Services.Configure<HostOptions>(options =>
            options.ShutdownTimeout = TimeSpan.FromSeconds(10));

        // Load bootstrap config
        var bootstrapPath = Path.Combine(Paths.ConfigPath, "bootstrap.json");
        BootstrapConfig? bootstrap = null;

        if (File.Exists(bootstrapPath))
        {
            try
            {
                var json = File.ReadAllText(bootstrapPath);
                bootstrap = JsonSerializer.Deserialize<BootstrapConfig>(json);
            }
            catch
            {
                // Use defaults
            }
        }

        bootstrap ??= new BootstrapConfig
        {
            ApiBaseUrl = "https://api.innerworks.com.br",
            HeartbeatIntervalSeconds = 60,
            CollectionIntervalSeconds = 15
        };

        // Core services
        builder.Services.AddSingleton(bootstrap);
        builder.Services.AddSingleton<SqliteOutbox>(sp =>
            new SqliteOutbox(Paths.DataPath));
        builder.Services.AddSingleton(sp =>
            new SecureStorage(Paths.DataPath));
        builder.Services.AddSingleton(sp =>
            new JwtService("inner-monitoring-agent-jwt-signing-key-v1"));
        builder.Services.AddSingleton<CollectorRegistry>(sp =>
        {
            var collectors = new IObservationCollector[]
            {
                new SystemInfoCollector(),
                new UptimeCollector(),
                new CpuCollector(),
                new MemoryCollector(),
                new DiskCollector()
            };
            return new CollectorRegistry(collectors);
        });

        // HTTP client
        builder.Services.AddHttpClient();

        // Application services
        builder.Services.AddSingleton<IEnrollmentService>(sp =>
        {
            var httpFactory = sp.GetRequiredService<IHttpClientFactory>();
            var http = httpFactory.CreateClient();
            return new EnrollmentService(
                http,
                sp.GetRequiredService<SecureStorage>(),
                sp.GetRequiredService<JwtService>(),
                sp.GetRequiredService<ILogger<EnrollmentService>>(),
                bootstrap.ApiBaseUrl);
        });

        builder.Services.AddSingleton<IConfigurationService>(sp =>
            new ConfigurationService(
                sp.GetRequiredService<IEnrollmentService>(),
                sp.GetRequiredService<ILogger<ConfigurationService>>(),
                Paths.DataPath));

        builder.Services.AddSingleton<IHeartbeatService>(sp =>
            new HeartbeatService(
                sp.GetRequiredService<IEnrollmentService>(),
                sp.GetRequiredService<SqliteOutbox>(),
                sp.GetRequiredService<ILogger<HeartbeatService>>()));

        // Outbox wrapper for IOutbox interface
        builder.Services.AddSingleton<IOutbox>(sp => sp.GetRequiredService<SqliteOutbox>());

        // Command executor
        builder.Services.AddSingleton<ICommandExecutor>(sp =>
            new CommandExecutor(
                sp.GetRequiredService<CollectorRegistry>(),
                sp.GetRequiredService<SqliteOutbox>(),
                sp.GetRequiredService<IConfigurationService>(),
                sp.GetRequiredService<ILogger<CommandExecutor>>()));

        // Worker
        builder.Services.AddHostedService<AgentWorker>();

        return builder.Build();
    }

    private class BootstrapConfig
    {
        public string ApiBaseUrl { get; set; } = "https://api.innerworks.com.br";
        public int HeartbeatIntervalSeconds { get; set; } = 60;
        public int CollectionIntervalSeconds { get; set; } = 15;
    }
}
