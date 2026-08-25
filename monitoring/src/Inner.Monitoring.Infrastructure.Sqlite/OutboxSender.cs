using System.IO.Compression;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Infrastructure.Sqlite;

/// <summary>
///     Resposta de ACK do servidor.
/// </summary>
internal sealed record BatchAckResponse
{
    public required string Status { get; init; }
    public required Guid BatchId { get; init; }
    public required long Sequence { get; init; }
    public DateTimeOffset? PersistedAt { get; init; }
    public long HighestContiguousSequence { get; init; }
    public required string ProcessingStatus { get; init; }
    public Guid? RequestId { get; init; }
}

/// <summary>
///     Sender para enviar batches pendentes da outbox para o servidor.
/// </summary>
public class OutboxSender
{
    private readonly HttpClient _httpClient;
    private readonly OutboxService _outboxService;
    private readonly ILogger<OutboxSender> _logger;
    private readonly string _sourceId;
    private readonly string _accessToken;

    private const int BatchSizeLimit = 1024 * 1024; // 1MB por batch
    private const int MaxRetries = 3;
    private const int TimeoutSeconds = 60;

    public OutboxSender(
        HttpClient httpClient,
        OutboxService outboxService,
        ILogger<OutboxSender> logger,
        string sourceId,
        string accessToken)
    {
        _httpClient = httpClient;
        _outboxService = outboxService;
        _logger = logger;
        _sourceId = sourceId;
        _accessToken = accessToken;

        _httpClient.Timeout = TimeSpan.FromSeconds(TimeoutSeconds);
    }

    /// <summary>
    ///     Envia batches pendentes.
    /// </summary>
    public async Task<SendResult> SendPendingBatchesAsync(CancellationToken cancellationToken = default)
    {
        var result = new SendResult();
        var batches = await _outboxService.GetPendingBatchesAsync(limit: 50, cancellationToken);

        if (batches.Count == 0)
        {
            _logger.LogDebug("Nenhum batch pendente para enviar");
            return result;
        }

        _logger.LogInformation("Enviando {Count} batches pendentes", batches.Count);

        foreach (var batch in batches)
        {
            var sendResult = await SendBatchAsync(batch, cancellationToken);
            result.Merge(sendResult);
        }

        return result;
    }

    /// <summary>
    ///     Envia um batch específico.
    /// </summary>
    public async Task<BatchSendResult> SendBatchAsync(OutboxBatch batch, CancellationToken cancellationToken = default)
    {
        try
        {
            // Marcar como sending
            await _outboxService.MarkSendingAsync(batch.BatchId, cancellationToken);

            // Decomprimir payload
            var payload = OutboxService.DecompressPayload(batch.CompressedPayload);

            // Tentar enviar com retry
            for (int attempt = 1; attempt <= MaxRetries; attempt++)
            {
                try
                {
                    var response = await SendToServerAsync(batch.BatchId, payload, cancellationToken);

                    if (response.IsSuccess)
                    {
                        await _outboxService.MarkAckedAsync(batch.BatchId, cancellationToken);
                        return BatchSendResult.Succeeded(response.HighestContiguousSequence);
                    }

                    if (response.StatusCode == 429 || response.StatusCode == 503)
                    {
                        // Rate limit ou unavailable - manter na outbox
                        await _outboxService.MarkFailedAsync(
                            batch.BatchId,
                            $"HTTP_{response.StatusCode}",
                            response.Message,
                            cancellationToken);

                        return BatchSendResult.RateLimitReached(response.StatusCode, response.RetryAfterSeconds);
                    }

                    // Outros erros - retry
                    if (attempt < MaxRetries)
                    {
                        _logger.LogWarning(
                            "Batch {BatchId} falhou (attempt {Attempt}/{MaxRetries}), HTTP {StatusCode}",
                            batch.BatchId, attempt, MaxRetries, response.StatusCode);

                        await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), cancellationToken);
                        await _outboxService.MarkSendingAsync(batch.BatchId, cancellationToken);
                    }
                    else
                    {
                        await _outboxService.MarkFailedAsync(
                            batch.BatchId,
                            $"HTTP_{response.StatusCode}",
                            response.Message,
                            cancellationToken);

                        return BatchSendResult.Failure($"HTTP {response.StatusCode}: {response.Message}");
                    }
                }
                catch (HttpRequestException ex) when (attempt < MaxRetries)
                {
                    _logger.LogWarning(ex,
                        "Batch {BatchId} falhou com exceção (attempt {Attempt}/{MaxRetries})",
                        batch.BatchId, attempt, MaxRetries);

                    await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), cancellationToken);
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Envio do batch {BatchId} cancelado", batch.BatchId);
            return BatchSendResult.OperationCancelled();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar batch {BatchId}", batch.BatchId);
            await _outboxService.MarkFailedAsync(
                batch.BatchId,
                "EXCEPTION",
                ex.Message,
                cancellationToken);

            return BatchSendResult.Failure(ex.Message);
        }

        return BatchSendResult.Failure("Max retries exceeded");
    }

    private async Task<ServerResponse> SendToServerAsync(Guid batchId, byte[] payload, CancellationToken cancellationToken)
    {
        var url = $"/api/monitoring/v1/sources/{_sourceId}/batches";

        using var content = new ByteArrayContent(payload);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
        content.Headers.ContentEncoding.Add("gzip");
        content.Headers.Add("X-Batch-Id", batchId.ToString());

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = content
        };

        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);

        var response = await _httpClient.SendAsync(request, cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            var ack = await response.Content.ReadFromJsonAsync<BatchAckResponse>(cancellationToken: cancellationToken);
            return ServerResponse.Succeeded(ack?.HighestContiguousSequence ?? 0);
        }

        var message = await response.Content.ReadAsStringAsync(cancellationToken);
        var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 60;

        return ServerResponse.Failed((int)response.StatusCode, message, (int)retryAfter);
    }

    /// <summary>
    ///     Obtém batches falhados para debug/reporte.
    /// </summary>
    public async Task<IReadOnlyList<OutboxBatch>> GetFailedBatchesAsync(CancellationToken cancellationToken = default)
    {
        return await _outboxService.GetStatsAsync(cancellationToken) is null
            ? Array.Empty<OutboxBatch>()
            : Array.Empty<OutboxBatch>();
    }
}

/// <summary>
///     Resultado do envio de um batch.
/// </summary>
public record BatchSendResult
{
    public bool Success { get; init; }
    public long HighestContiguousSequence { get; init; }
    public int? RetryAfterSeconds { get; init; }
    public string? Error { get; init; }
    public bool RateLimited { get; init; }
    public bool Cancelled { get; init; }

    public static BatchSendResult Succeeded(long highestContiguousSequence) => new()
    {
        Success = true,
        HighestContiguousSequence = highestContiguousSequence
    };

    public static BatchSendResult RateLimitReached(int statusCode, int retryAfterSeconds) => new()
    {
        Success = false,
        RateLimited = true,
        RetryAfterSeconds = retryAfterSeconds,
        Error = $"Rate limited: HTTP {statusCode}"
    };

    public static BatchSendResult Failure(string error) => new()
    {
        Success = false,
        Error = error
    };

    public static BatchSendResult OperationCancelled() => new()
    {
        Success = false,
        Cancelled = true,
        Error = "Operation cancelled"
    };
}

/// <summary>
///     Resultado do envío de múltiplos batches.
/// </summary>
public record SendResult
{
    public int Sent { get; private set; }
    public int Failed { get; private set; }
    public int RateLimited { get; private set; }
    public int Cancelled { get; private set; }
    public long LastHighestContiguousSequence { get; private set; }

    public void Merge(BatchSendResult result)
    {
        if (result.Success)
        {
            Sent++;
            if (result.HighestContiguousSequence > LastHighestContiguousSequence)
            {
                LastHighestContiguousSequence = result.HighestContiguousSequence;
            }
        }
        else if (result.RateLimited)
        {
            RateLimited++;
        }
        else if (result.Cancelled)
        {
            Cancelled++;
        }
        else
        {
            Failed++;
        }
    }
}

/// <summary>
///     Resposta do servidor.
/// </summary>
internal record ServerResponse
{
    public bool IsSuccess { get; init; }
    public int StatusCode { get; init; }
    public string Message { get; init; } = string.Empty;
    public int RetryAfterSeconds { get; init; }
    public long HighestContiguousSequence { get; init; }

    public static ServerResponse Succeeded(long highestContiguousSequence) => new()
    {
        IsSuccess = true,
        StatusCode = 200,
        HighestContiguousSequence = highestContiguousSequence
    };

    public static ServerResponse Failed(int statusCode, string message, int retryAfterSeconds = 60) => new()
    {
        IsSuccess = false,
        StatusCode = statusCode,
        Message = message,
        RetryAfterSeconds = retryAfterSeconds
    };
}
