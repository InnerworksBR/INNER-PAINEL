using Inner.Monitoring.Edge.Collector;
using Inner.Monitoring.Edge.Collector.Classification;
using Inner.Monitoring.Edge.Collector.Concurrency;
using Inner.Monitoring.Edge.Collector.Discovery;
using Inner.Monitoring.Edge.Collector.Polling;
using Inner.Monitoring.Edge.Collector.Profiles;
using Inner.Monitoring.Edge.Collector.Security;
using Inner.Monitoring.Edge.Collector.Snmp;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

// Configure Serilog
using Serilog;
using Serilog.Events;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    Log.Information("Starting Inner Edge Collector...");

    var builder = Host.CreateApplicationBuilder(args);

    // Register Serilog
    builder.Services.AddSerilog();

    // Register options
    builder.Services.AddOptions<CollectorOptions>()
        .Bind(builder.Configuration.GetSection("Collector"))
        .ValidateOnStart();

    // Register SNMP client
    builder.Services.AddSingleton<ISnmpClient>(sp =>
    {
        var logger = sp.GetRequiredService<ILogger<SharpSnmpClient>>();
        var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<CollectorOptions>>().Value;
        return new SharpSnmpClient(logger, options.SnmpTimeoutMs);
    });

    // Register range planner
    builder.Services.AddSingleton<IRangePlanner, CidrRangePlanner>();

    // Register classifier
    builder.Services.AddSingleton<IDeviceClassifier, NetworkDeviceClassifier>();

    // Register profile resolver
    builder.Services.AddSingleton<IProfileResolver, ProfileResolver>();

    // Register concurrency limiter
    builder.Services.AddSingleton<IConcurrencyLimiter>(sp =>
    {
        var logger = sp.GetRequiredService<ILogger<SemaphoreConcurrencyLimiter>>();
        var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<CollectorOptions>>().Value;
        return new SemaphoreConcurrencyLimiter(
            logger,
            options.MaxConcurrentProbes,
            options.MaxConcurrentPolling,
            options.MaxRequestsPerSecond);
    });

    // Register credential manager
    builder.Services.AddSingleton<ICredentialManager>(sp =>
    {
        var logger = sp.GetRequiredService<ILogger<CredentialManager>>();
        var keyProvider = new MasterKeyProvider(
            sp.GetRequiredService<ILogger<MasterKeyProvider>>(),
            "master.key");
        return new CredentialManager(logger, keyProvider.GetMasterKey());
    });

    // Register discovery pipeline
    builder.Services.AddScoped<IDiscoveryPipeline, SnmpDiscoveryPipeline>();

    // Register polling executor
    builder.Services.AddScoped<IPollingExecutor, PollingExecutor>();

    // Register hosted service
    builder.Services.AddHostedService<EdgeCollectorHostedService>();

    // Build and run
    var host = builder.Build();

    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}

return 0;
