using System.IO.Compression;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Inner.Monitoring.Cloud.Api.Jwt;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

using SourceConfigEntity = Inner.Monitoring.Domain.Entities.SourceConfiguration;
using SourceConfigRecord = Inner.Monitoring.Contracts.Records.SourceConfiguration;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
///     Controller para registro e comunicação de sources (agents e collectors).
/// </summary>
[ApiController]
[Route("api/monitoring/v1/sources")]
[Produces("application/json")]
public class SourcesController : ControllerBase
{
    private readonly MonitoringDbContext _db;
    private readonly JwtService _jwtService;
    private readonly ILogger<SourcesController> _logger;

    public SourcesController(
        MonitoringDbContext db,
        JwtService jwtService,
        ILogger<SourcesController> logger)
    {
        _db = db;
        _jwtService = jwtService;
        _logger = logger;
    }

    /// <summary>
    ///     Registra uma nova source usando token de ativação.
    ///     Rate limit: 5 requisições por 10 minutos por IP.
    /// </summary>
    [HttpPost("register")]
    [EnableRateLimiting("registration")]
    [ProducesResponseType(typeof(SourceRegistrationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register(
        [FromBody] SourceRegistrationRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ActivationToken))
        {
            return BadRequest(new ErrorResponse("Activation token is required"));
        }

        if (request.InstallationId == Guid.Empty ||
            string.IsNullOrWhiteSpace(request.SourceType) ||
            string.IsNullOrWhiteSpace(request.DisplayName) ||
            string.IsNullOrWhiteSpace(request.Platform) ||
            string.IsNullOrWhiteSpace(request.Architecture) ||
            string.IsNullOrWhiteSpace(request.SourceVersion) ||
            request.Capabilities == null)
        {
            return BadRequest(new ErrorResponse("Invalid source registration payload"));
        }

        // Validar token de ativação
        var tokenHash = ComputeTokenHash(request.ActivationToken);
        var activationToken = await _db.ActivationTokens
            .FirstOrDefaultAsync(t =>
                t.TokenHash == tokenHash &&
                t.ExpiresAt > DateTimeOffset.UtcNow &&
                t.UsedAt == null &&
                t.RevokedAt == null,
                cancellationToken);

        if (activationToken == null)
        {
            _logger.LogWarning("Tentativa de registro com token inválido ou expirado");
            return Unauthorized(new ErrorResponse("Invalid or expired activation token"));
        }

        // Verificar InstallationId único
        var existingSource = await _db.Sources
            .FirstOrDefaultAsync(s =>
                s.CompanyId == activationToken.CompanyId &&
                s.InstallationId == request.InstallationId &&
                s.DeletedAt == null,
                cancellationToken);

        if (existingSource != null)
        {
            // Re-registro - retornar credenciais existentes
            var existingCredential = await _db.SourceCredentials
                .Where(c => c.SourceId == existingSource.Id && c.RevokedAt == null)
                .OrderByDescending(c => c.CredentialVersion)
                .FirstOrDefaultAsync(cancellationToken);

            if (existingCredential != null)
            {
                var refreshResponse = await CreateRefreshResponseAsync(existingSource, existingCredential, cancellationToken);
                return Ok(refreshResponse);
            }
        }

        // Determinar tipo de source
        var sourceType = request.SourceType.ToLowerInvariant() switch
        {
            "agent" => Contracts.Enums.SourceType.Agent,
            "collector" => Contracts.Enums.SourceType.Collector,
            _ => Contracts.Enums.SourceType.Agent
        };

        // Criar source
        var source = Source.Create(
            activationToken.CompanyId,
            activationToken.SiteId ?? Guid.Empty,
            sourceType,
            request.InstallationId,
            request.DisplayName,
            request.Platform,
            request.Architecture,
            request.SourceVersion,
            heartbeatIntervalSeconds: 60);

        // Capturar capabilities
        source.SetCapabilities(JsonSerializer.Serialize(new
        {
            hostMetrics = request.Capabilities.HostMetrics,
            hyperv = request.Capabilities.HyperV,
            snmpV2c = request.Capabilities.SnmpV2c,
            snmpV3 = request.Capabilities.SnmpV3
        }));

        // Usar o token de ativação
        activationToken.MarkUsed();

        // Criar credenciais
        var accessToken = _jwtService.GenerateAccessToken(source.Id, source.CompanyId);
        var refreshToken = GenerateRefreshToken();
        var credential = SourceCredential.Create(source.Id, ComputeTokenHash(refreshToken));

        // Criar cursor de sequência
        var cursor = SourceSequenceCursor.Create(source.Id);

        using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            _db.Sources.Add(source);
            _db.SourceCredentials.Add(credential);
            _db.SourceSequenceCursors.Add(cursor);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        _logger.LogInformation(
            "Source {SourceId} registrada (company={CompanyId}, site={SiteId}, type={SourceType})",
            source.Id, source.CompanyId, source.SiteId, source.SourceType);

        return Ok(CreateRegistrationResponse(source, accessToken, refreshToken, credential));
    }

    /// <summary>
    ///     Recebe batches de métricas da source.
    ///     Idempotency: usa batch_id como chave.
    /// </summary>
    [HttpPost("{sourceId:guid}/batches")]
    [ProducesResponseType(typeof(BatchSubmissionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> SubmitBatch(
        [FromRoute] Guid sourceId,
        [FromHeader(Name = "X-Batch-Id")] Guid? batchIdHeader,
        CancellationToken cancellationToken)
    {
        // Autenticação via Bearer token
        var authResult = await AuthenticateSourceAsync(sourceId, cancellationToken);
        if (!authResult.Success)
        {
            return Unauthorized(new ErrorResponse(authResult.Error ?? "Unauthorized"));
        }

        var source = authResult.Source!;
        var companyId = authResult.CompanyId!.Value;

        // Obter batch_id do header ou do body
        Guid? batchId = batchIdHeader;

        // Ler e decomprimir body
        byte[] bodyBytes;
        using (var reader = new StreamReader(Request.Body))
        {
            using var memStream = new MemoryStream();
            await Request.Body.CopyToAsync(memStream);
            bodyBytes = memStream.ToArray();
        }

        // Verificar Content-Encoding
        var isGzipped = Request.Headers.ContentEncoding.Contains("gzip");
        if (isGzipped)
        {
            bodyBytes = DecompressGzip(bodyBytes);
        }

        // Parse do payload
        BatchSubmission? submission;
        try
        {
            submission = JsonSerializer.Deserialize<BatchSubmission>(bodyBytes, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Payload de batch inválido para source {SourceId}", sourceId);
            return BadRequest(new ErrorResponse("Invalid batch payload format"));
        }

        if (submission == null)
        {
            return BadRequest(new ErrorResponse("Empty batch payload"));
        }

        // Usar batch_id do body se não vier no header
        batchId ??= submission.BatchId;

        // Verificar idempotency
        var existingBatch = await _db.IngestBatches
            .FirstOrDefaultAsync(b => b.SourceId == sourceId && b.BatchId == batchId, cancellationToken);

        if (existingBatch != null)
        {
            // Duplicado - retornar idempotent
            var existingCursor = await _db.SourceSequenceCursors
                .FirstOrDefaultAsync(c => c.SourceId == sourceId, cancellationToken);

            return Ok(new BatchSubmissionResponse(
                Status: "duplicate",
                BatchId: existingBatch.BatchId,
                Sequence: existingBatch.Sequence,
                PersistedAt: existingBatch.ReceivedAt,
                HighestContiguousSequence: existingCursor?.HighestContiguousSequence ?? 0,
                ProcessingStatus: existingBatch.Status.ToString().ToLowerInvariant(),
                RequestId: Guid.NewGuid()));
        }

        // Calcular hash do conteúdo
        var contentHash = ComputeSha256(bodyBytes);

        // Iniciar transação para INSERT batch + INSERT job
        using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Verificar sequência
            var cursor = await _db.SourceSequenceCursors
                .FromSqlRaw(
                    "SELECT source_id, highest_received_sequence, highest_contiguous_sequence, updated_at FROM monitoring.source_sequence_cursors WHERE source_id = {0} FOR UPDATE",
                    sourceId)
                .FirstOrDefaultAsync(cancellationToken);

            if (cursor == null)
            {
                cursor = SourceSequenceCursor.Create(sourceId);
                _db.SourceSequenceCursors.Add(cursor);
            }

            // Verificar sequência duplicada
            var duplicateSequence = await _db.IngestBatches
                .AnyAsync(b => b.SourceId == sourceId && b.Sequence == submission.Sequence, cancellationToken);

            if (duplicateSequence)
            {
                await transaction.RollbackAsync(cancellationToken);
                return Ok(new BatchSubmissionResponse(
                    Status: "duplicate",
                    BatchId: batchId.Value,
                    Sequence: submission.Sequence,
                    PersistedAt: DateTimeOffset.UtcNow,
                    HighestContiguousSequence: cursor.HighestContiguousSequence,
                    ProcessingStatus: "received",
                    RequestId: Guid.NewGuid()));
            }

            // Criar batch
            var batch = IngestBatch.Create(
                companyId,
                sourceId,
                batchId.Value,
                submission.Sequence,
                submission.SchemaVersion,
                submission.SourceVersion,
                contentHash,
                submission.Records.Count,
                bodyBytes.Length,
                bodyBytes.Length,
                submission.CollectedFrom,
                submission.CollectedTo,
                submission.SentAt,
                JsonDocument.Parse(bodyBytes));

            // Criar job de processamento
            var job = ProcessingJob.Create(
                batch.Id,
                companyId,
                sourceId,
                priority: submission.CollectedTo > DateTimeOffset.UtcNow.AddMinutes(-5) ? 50 : 100);

            _db.IngestBatches.Add(batch);
            _db.ProcessingJobs.Add(job);

            // Atualizar cursor
            cursor.UpdateReceived(submission.Sequence);
            if (submission.Sequence > cursor.HighestContiguousSequence)
            {
                cursor.UpdateContiguous(submission.Sequence);
            }

            // Atualizar source
            source.RecordIngest();

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation(
                "Batch {BatchId} persistido (source={SourceId}, seq={Sequence}, records={RecordCount})",
                batchId, sourceId, submission.Sequence, submission.Records.Count);

            // CONFIRMAÇÃO APÓS COMMIT
            return Ok(new BatchSubmissionResponse(
                Status: "accepted",
                BatchId: batchId.Value,
                Sequence: submission.Sequence,
                PersistedAt: batch.ReceivedAt,
                HighestContiguousSequence: cursor.HighestContiguousSequence,
                ProcessingStatus: "received",
                RequestId: Guid.NewGuid()));
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Erro ao persistir batch {BatchId}", batchId);
            throw;
        }
    }

    /// <summary>
    ///     Recebe heartbeat da source.
    /// </summary>
    [HttpPost("{sourceId:guid}/heartbeat")]
    [ProducesResponseType(typeof(HeartbeatResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Heartbeat(
        [FromRoute] Guid sourceId,
        [FromBody] HeartbeatRequest request,
        CancellationToken cancellationToken)
    {
        var authResult = await AuthenticateSourceAsync(sourceId, cancellationToken);
        if (!authResult.Success)
        {
            return Unauthorized(new ErrorResponse(authResult.Error ?? "Unauthorized"));
        }

        var source = authResult.Source!;

        // Atualizar heartbeat
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        source.RecordHeartbeat(request.SourceTime, clientIp);
        source.UpdateVersion(request.SourceVersion);

        // Atualizar health summary
        source.SetHealthSummary(JsonSerializer.Serialize(new
        {
            status = request.LocalHealth.Status,
            warnings = request.LocalHealth.Warnings,
            collection = request.Collection
        }));

        // Buscar config atual
        var currentConfig = await _db.SourceConfigurations
            .Where(c => c.SourceId == sourceId && c.Status == "active")
            .OrderByDescending(c => c.Version)
            .FirstOrDefaultAsync(cancellationToken);

        var desiredConfigVersion = currentConfig?.Version ?? 0;
        var configChanged = request.ConfigVersion != desiredConfigVersion;

        // Contar comandos disponíveis
        var commandsAvailable = await _db.Commands
            .CountAsync(c =>
                c.SourceId == sourceId &&
                c.Status == Contracts.Enums.CommandStatus.Pending &&
                c.AvailableAt <= DateTimeOffset.UtcNow &&
                c.ExpiresAt > DateTimeOffset.UtcNow,
                cancellationToken);

        // Determinar próximo intervalo de heartbeat
        var nextHeartbeatSeconds = CalculateNextHeartbeatInterval(source, request);

        await _db.SaveChangesAsync(cancellationToken);

        // Determinar status da versão
        var versionStatus = DetermineVersionStatus(source, request);

        return Ok(new HeartbeatResponse(
            ServerTime: DateTimeOffset.UtcNow,
            SourceStatus: source.Status.ToString().ToLowerInvariant(),
            DesiredConfigVersion: desiredConfigVersion,
            ConfigurationChanged: configChanged,
            CommandsAvailable: commandsAvailable,
            MinimumVersion: source.MinimumVersion,
            RecommendedVersion: source.DesiredVersion,
            VersionStatus: versionStatus,
            NextHeartbeatSeconds: nextHeartbeatSeconds));
    }

    /// <summary>
    ///     Obtém configuração atualizada para a source.
    /// </summary>
    [HttpGet("{sourceId:guid}/configuration")]
    [ProducesResponseType(typeof(SourceConfigRecord), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    public async Task<IActionResult> GetConfiguration(
        [FromRoute] Guid sourceId,
        [FromHeader(Name = "If-None-Match")] string? ifNoneMatch,
        CancellationToken cancellationToken)
    {
        var authResult = await AuthenticateSourceAsync(sourceId, cancellationToken);
        if (!authResult.Success)
        {
            return Unauthorized(new ErrorResponse(authResult.Error ?? "Unauthorized"));
        }

        var config = await _db.SourceConfigurations
            .Where(c => c.SourceId == sourceId && c.Status == "active")
            .OrderByDescending(c => c.Version)
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            // Retornar configuração padrão
            return Ok(CreateDefaultConfiguration(sourceId));
        }

        // Verificar ETag
        var etag = $"\"{config.ConfigHash}\"";
        if (ifNoneMatch == etag)
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        Response.Headers.ETag = etag;

        // Parse e retornar configuração
        var configData = JsonSerializer.Deserialize<JsonDocument>(config.Config);
        if (configData == null)
        {
            return Ok(CreateDefaultConfiguration(sourceId));
        }

        return Ok(CreateConfigurationFromJson(config.Config, config.Version, Convert.ToBase64String(config.ConfigHash)));
    }

    /// <summary>
    ///     Obtém comandos pendentes para a source.
    /// </summary>
    [HttpGet("{sourceId:guid}/commands")]
    [ProducesResponseType(typeof(IReadOnlyList<CommandPayload>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCommands(
        [FromRoute] Guid sourceId,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        var authResult = await AuthenticateSourceAsync(sourceId, cancellationToken);
        if (!authResult.Success)
        {
            return Unauthorized(new ErrorResponse(authResult.Error ?? "Unauthorized"));
        }

        var commands = await _db.Commands
            .Where(c =>
                c.SourceId == sourceId &&
                c.Status == Contracts.Enums.CommandStatus.Pending &&
                c.AvailableAt <= DateTimeOffset.UtcNow &&
                c.ExpiresAt > DateTimeOffset.UtcNow)
            .OrderBy(c => c.Priority)
            .ThenBy(c => c.AvailableAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var payloads = commands.Select(c => new CommandPayload(
            c.Id,
            c.CommandType,
            c.Parameters != null ? JsonSerializer.Deserialize<JsonDocument>(c.Parameters)?.RootElement : null,
            c.IdempotencyKey,
            c.Priority,
            c.ExpiresAt,
            c.MaxAttempts)).ToList();

        return Ok(payloads);
    }

    // ========================================
    // Métodos auxiliares
    // ========================================

    private async Task<AuthResult> AuthenticateSourceAsync(Guid sourceId, CancellationToken cancellationToken)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return AuthResult.Failure("Missing or invalid authorization header");
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var principal = _jwtService.ValidateAccessToken(token);

        if (principal == null)
        {
            return AuthResult.Failure("Invalid access token");
        }

        var tokenSourceId = principal.FindFirst("source_id")?.Value;
        var tokenCompanyId = principal.FindFirst("company_id")?.Value;

        if (tokenSourceId == null || !Guid.TryParse(tokenSourceId, out var tokenSourceGuid) || tokenSourceGuid != sourceId)
        {
            return AuthResult.Failure("Token source_id mismatch");
        }

        var source = await _db.Sources
            .FirstOrDefaultAsync(s => s.Id == sourceId && s.DeletedAt == null, cancellationToken);

        if (source == null)
        {
            return AuthResult.Failure("Source not found");
        }

        if (!source.IsActive)
        {
            return AuthResult.Failure("Source is not active");
        }

        return AuthResult.Successful(source, Guid.Parse(tokenCompanyId!));
    }

    private SourceRegistrationResponse CreateRegistrationResponse(
        Source source,
        string accessToken,
        string refreshToken,
        SourceCredential credential)
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}";

        return new SourceRegistrationResponse(
            SourceId: source.Id,
            CompanyId: source.CompanyId,
            SiteId: source.SiteId,
            AccessToken: accessToken,
            AccessTokenExpiresAt: DateTimeOffset.UtcNow.AddMinutes(15),
            RefreshToken: refreshToken,
            RefreshTokenExpiresAt: DateTimeOffset.UtcNow.AddDays(7),
            HeartbeatIntervalSeconds: source.HeartbeatIntervalSeconds,
            ConfigVersion: source.ConfigVersion,
            Endpoints: new SourceEndpoints(
                Heartbeat: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/heartbeat",
                Configuration: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/configuration",
                Batches: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/batches",
                Commands: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/commands"),
            ServerTime: DateTimeOffset.UtcNow);
    }

    private async Task<SourceRegistrationResponse> CreateRefreshResponseAsync(
        Source source,
        SourceCredential credential,
        CancellationToken cancellationToken)
    {
        var newAccessToken = _jwtService.GenerateAccessToken(source.Id, source.CompanyId);
        var newRefreshToken = GenerateRefreshToken();

        credential.Rotate(ComputeTokenHash(newRefreshToken));

        await _db.SaveChangesAsync(cancellationToken);

        var baseUrl = $"{Request.Scheme}://{Request.Host}";

        return new SourceRegistrationResponse(
            SourceId: source.Id,
            CompanyId: source.CompanyId,
            SiteId: source.SiteId,
            AccessToken: newAccessToken,
            AccessTokenExpiresAt: DateTimeOffset.UtcNow.AddMinutes(15),
            RefreshToken: newRefreshToken,
            RefreshTokenExpiresAt: DateTimeOffset.UtcNow.AddDays(7),
            HeartbeatIntervalSeconds: source.HeartbeatIntervalSeconds,
            ConfigVersion: source.ConfigVersion,
            Endpoints: new SourceEndpoints(
                Heartbeat: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/heartbeat",
                Configuration: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/configuration",
                Batches: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/batches",
                Commands: $"{baseUrl}/api/monitoring/v1/sources/{source.Id}/commands"),
            ServerTime: DateTimeOffset.UtcNow);
    }

    private static string ComputeTokenHash(string token)
    {
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes);
    }

    private static byte[] DecompressGzip(byte[] compressed)
    {
        using var input = new MemoryStream(compressed);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();
        gzip.CopyTo(output);
        return output.ToArray();
    }

    private static byte[] ComputeSha256(byte[] data)
    {
        return SHA256.HashData(data);
    }

    private static string ComputeSha256Hex(byte[] data)
    {
        return Convert.ToHexString(ComputeSha256(data)).ToLowerInvariant();
    }

    private static int CalculateNextHeartbeatInterval(Source source, HeartbeatRequest request)
    {
        // Se a source está degradada, encurtar heartbeat
        if (source.Status == Contracts.Enums.SourceStatus.Degraded)
        {
            return Math.Max(30, source.HeartbeatIntervalSeconds / 2);
        }

        // Se há comandos pendentes, encurtar
        if (request.Collection.LastCycleResult == "failed")
        {
            return Math.Min(120, source.HeartbeatIntervalSeconds);
        }

        return source.HeartbeatIntervalSeconds;
    }

    private static string DetermineVersionStatus(Source source, HeartbeatRequest request)
    {
        if (!string.IsNullOrEmpty(source.MinimumVersion) &&
            CompareVersions(request.SourceVersion, source.MinimumVersion) < 0)
        {
            return "outdated";
        }

        if (!string.IsNullOrEmpty(source.DesiredVersion) &&
            CompareVersions(request.SourceVersion, source.DesiredVersion) < 0)
        {
            return "upgrade_available";
        }

        return "current";
    }

    private static int CompareVersions(string v1, string v2)
    {
        var parts1 = v1.Split('.').Select(int.Parse).ToArray();
        var parts2 = v2.Split('.').Select(int.Parse).ToArray();

        for (int i = 0; i < Math.Max(parts1.Length, parts2.Length); i++)
        {
            var p1 = i < parts1.Length ? parts1[i] : 0;
            var p2 = i < parts2.Length ? parts2[i] : 0;

            if (p1 != p2) return p1.CompareTo(p2);
        }

        return 0;
    }

    private static SourceConfigRecord CreateDefaultConfiguration(Guid sourceId)
    {
        return new SourceConfigRecord(
            SchemaVersion: 1,
            ConfigVersion: 1,
            EffectiveAt: DateTimeOffset.UtcNow,
            ConfigHash: ComputeSha256Hex(System.Text.Encoding.UTF8.GetBytes("{}")),
            Common: new CommonConfiguration(
                HeartbeatIntervalSeconds: 60,
                BatchFlushSeconds: 30,
                BatchMaxRecords: 1000,
                BatchTargetCompressedBytes: 256 * 1024,
                BatchMaxCompressedBytes: 1024 * 1024,
                BatchMaxUncompressedBytes: 10 * 1024 * 1024,
                OutboxMaxBytes: 50 * 1024 * 1024,
                OutboxMaxAgeSeconds: 3600,
                HttpTimeoutSeconds: 30,
                LogLevel: "Information"),
            Agent: new AgentConfiguration(
                CollectionIntervalSeconds: 60,
                EnabledCollectors: new[] { "cpu", "memory", "disk", "network" },
                Capabilities: new Dictionary<string, bool>()),
            Collector: null,
            AllowedCommands: Array.Empty<string>());
    }

    private static SourceConfigRecord CreateConfigurationFromJson(string json, long version, string configHash)
    {
        var doc = JsonSerializer.Deserialize<JsonDocument>(json);
        if (doc == null) return CreateDefaultConfiguration(Guid.Empty);

        return new SourceConfigRecord(
            SchemaVersion: doc.RootElement.GetProperty("schema_version").GetInt32(),
            ConfigVersion: version,
            EffectiveAt: DateTimeOffset.UtcNow,
            ConfigHash: configHash,
            Common: new CommonConfiguration(
                HeartbeatIntervalSeconds: doc.RootElement.GetProperty("common").GetProperty("heartbeat_interval_seconds").GetInt32(),
                BatchFlushSeconds: doc.RootElement.GetProperty("common").GetProperty("batch_flush_seconds").GetInt32(),
                BatchMaxRecords: doc.RootElement.GetProperty("common").GetProperty("batch_max_records").GetInt32(),
                BatchTargetCompressedBytes: doc.RootElement.GetProperty("common").GetProperty("batch_target_compressed_bytes").GetInt64(),
                BatchMaxCompressedBytes: doc.RootElement.GetProperty("common").GetProperty("batch_max_compressed_bytes").GetInt64(),
                BatchMaxUncompressedBytes: doc.RootElement.GetProperty("common").GetProperty("batch_max_uncompressed_bytes").GetInt64(),
                OutboxMaxBytes: doc.RootElement.GetProperty("common").GetProperty("outbox_max_bytes").GetInt64(),
                OutboxMaxAgeSeconds: doc.RootElement.GetProperty("common").GetProperty("outbox_max_age_seconds").GetInt32(),
                HttpTimeoutSeconds: doc.RootElement.GetProperty("common").GetProperty("http_timeout_seconds").GetInt32(),
                LogLevel: doc.RootElement.GetProperty("common").GetProperty("log_level").GetString() ?? "Information"),
            Agent: null,
            Collector: null,
            AllowedCommands: Array.Empty<string>());
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };
}

internal record AuthResult(bool Success, Source? Source, Guid? CompanyId, string? Error)
{
    public static AuthResult Successful(Source source, Guid companyId) => new(true, source, companyId, null);
    public static AuthResult Failure(string error) => new(false, null, null, error);
}

internal record ErrorResponse(string Error);

internal record CommandPayload(
    Guid Id,
    string CommandType,
    JsonElement? Parameters,
    string? IdempotencyKey,
    int Priority,
    DateTimeOffset ExpiresAt,
    int MaxAttempts);
