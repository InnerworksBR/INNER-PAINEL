using System.Text.Json;
using System.Threading.RateLimiting;
using Inner.Monitoring.Application.QueryServices;
using Inner.Monitoring.Cloud.Api;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Cloud.Api.Infrastructure.HealthChecks;
using Inner.Monitoring.Cloud.Api.Jwt;
using Inner.Monitoring.Cloud.Api.Middleware;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Infrastructure.Postgres;
using Inner.Monitoring.Infrastructure.Postgres.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;
using HealthCheckOptions = Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions;

var builder = WebApplication.CreateBuilder(args);

// ============================================
// Configuracao de Logging Estruturado (Serilog)
// ============================================
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("MachineName", Environment.MachineName)
    .Enrich.WithProperty("Environment", builder.Environment.EnvironmentName)
    .Enrich.WithProperty("Application", "Inner.Monitoring.Api")
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .CreateLogger();

builder.Host.UseSerilog();

// ============================================
// Configuracao de Database (Supabase/PostgreSQL)
// ============================================
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? Environment.GetEnvironmentVariable("Database_ConnectionString")
    ?? "Host=localhost;Database=inner_monitoring;Username=postgres;Password=postgres";

builder.Services.AddDbContext<MonitoringDbContext>(options =>
{
    options.UseNpgsql(connectionString, npgsql =>
    {
        npgsql.EnableRetryOnFailure(3);
        npgsql.CommandTimeout(30);
        npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
    });
    options.EnableSensitiveDataLogging(builder.Environment.IsDevelopment());
    options.EnableDetailedErrors(builder.Environment.IsDevelopment());
});

// ============================================
// Registro de Repositorios
// ============================================
builder.Services.AddScoped<ISourceRepository, SourceRepository>();
builder.Services.AddScoped<IAssetRepository, AssetRepository>();
builder.Services.AddScoped<IIngestBatchRepository, IngestBatchRepository>();
builder.Services.AddScoped<IProcessingJobRepository, ProcessingJobRepository>();

// ============================================
// Registro de Query Services
// ============================================
builder.Services.AddScoped<ICockpitQueryService, CockpitQueryService>();
builder.Services.AddScoped<IAssetQueryService, AssetQueryService>();
builder.Services.AddScoped<ISourceQueryService, SourceQueryService>();
builder.Services.AddScoped<IEventQueryService, EventQueryService>();

// ============================================
// Configuracao de JWT
// ============================================
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
    ?? "dev-secret-key-change-in-production-min-32-chars!";

var jwtSettings = new JwtSettings
{
    SecretKey = jwtSecret,
    Issuer = "inner-monitoring",
    Audience = "inner-monitoring-api"
};

builder.Services.AddSingleton(jwtSettings);
builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton<PortalJwtService>();

// ============================================
// Configuracao de Autenticacao JWT Bearer
// ============================================
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };
    });

builder.Services.AddAuthorization();

// ============================================
// Configuracao de Rate Limiting
// ============================================
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    // Rate limit para registro: 5 por 10 minutos por IP
    options.AddPolicy("registration", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(10),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Rate limit para batches: 100 por minuto por source
    options.AddPolicy("batches", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Request.Headers.Authorization.FirstOrDefault() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 10
            }));

    // Rate limit para heartbeat: 10 por minuto por source
    options.AddPolicy("heartbeat", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: context.Request.Headers.Authorization.FirstOrDefault() ?? "anonymous",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5
            }));
});

// ============================================
// Configuracao de Health Checks
// ============================================
builder.Services.AddHealthChecks()
    // Database connectivity
    .AddCheck<DatabaseHealthCheck>("database", tags: new[] { "ready", "db" })
    // Migrations status
    .AddCheck<MigrationsHealthCheck>("migrations", tags: new[] { "ready", "migrations" })
    // Partition configuration
    .AddCheck<PartitionHealthCheck>("partitions", tags: new[] { "ready", "partitions" });

// ============================================
// Configuracao de Controllers
// ============================================
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Inner Monitoring API", Version = "v1" });
});

// ============================================
// Configuracao de CORS
// ============================================
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// ============================================
// Pipeline
// ============================================

// Correlation ID (deve ser primeiro)
app.UseCorrelationId();

// Swagger (desenvolvimento)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// CORS
app.UseCors();

// Rate limiting
app.UseRateLimiter();

// Health checks
// Liveness probe - apenas verifica se a aplicacao esta rodando
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = async (context, _) =>
    {
        context.Response.ContentType = "application/json";
        await JsonSerializer.SerializeAsync(context.Response.Body, new { status = "Healthy", timestamp = DateTimeOffset.UtcNow });
    }
});

// Readiness probe - verifica DB, migrations e particoes
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthCheckJsonWriter.WriteAspNetResponseAsync
});

// Health completo (verbose)
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = HealthCheckJsonWriter.WriteAspNetResponseAsync
});

// Routing
app.UseRouting();

// Autenticacao JWT
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// ============================================
// Inicializacao
// ============================================
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();

    try
    {
        var canConnect = await db.Database.CanConnectAsync();
        if (canConnect)
        {
            Log.Information("Conectado ao banco de dados");
        }
        else
        {
            Log.Warning("Nao foi possivel conectar ao banco");
        }
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Erro ao conectar ao banco");
    }
}

Log.Information("Inner Monitoring API iniciando na porta 5000");

app.Run();
