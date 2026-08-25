using Inner.Monitoring.Cloud.Worker;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;

var builder = Host.CreateApplicationBuilder(args);

// ============================================
// Configuração de Logging
// ============================================
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// ============================================
// Configuração de Database
// ============================================
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? "Host=localhost;Database=inner_monitoring;Username=postgres;Password=postgres";

builder.Services.AddDbContext<MonitoringDbContext>(options =>
{
    options.UseNpgsql(connectionString, npgsql =>
    {
        npgsql.EnableRetryOnFailure(3);
        npgsql.CommandTimeout(60);
    });
}, ServiceLifetime.Scoped);

// ============================================
// Configuração de Workers
// ============================================
var workerConfig = new WorkerConfig
{
    WorkerId = Environment.GetEnvironmentVariable("WORKER_ID") ?? Guid.NewGuid().ToString("N")[..8],
    PollIntervalSeconds = int.Parse(Environment.GetEnvironmentVariable("WORKER_POLL_INTERVAL") ?? "5"),
    LeaseDurationSeconds = int.Parse(Environment.GetEnvironmentVariable("WORKER_LEASE_DURATION") ?? "60"),
    MaxAttempts = int.Parse(Environment.GetEnvironmentVariable("WORKER_MAX_ATTEMPTS") ?? "10")
};

builder.Services.AddSingleton(workerConfig);

// Registrar os workers
builder.Services.AddHostedService<BatchProcessingWorker>();
builder.Services.AddHostedService<LeaseRecoveryWorker>();

var host = builder.Build();

// Log de inicialização
var logger = host.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("Worker iniciado com ID: {WorkerId}", workerConfig.WorkerId);

host.Run();
