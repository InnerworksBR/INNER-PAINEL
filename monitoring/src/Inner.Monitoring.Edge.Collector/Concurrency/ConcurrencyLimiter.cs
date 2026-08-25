using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Edge.Collector.Concurrency;

/// <summary>
///     Interface para controle de concorrência.
/// </summary>
public interface IConcurrencyLimiter
{
    /// <summary>
    ///     Executa trabalho com limite de concorrência por chave.
    /// </summary>
    Task<T> ExecuteAsync<T>(string key, Func<Task<T>> work, CancellationToken ct);

    /// <summary>
    ///     Obtém estatísticas atuais de concorrência.
    /// </summary>
    ConcurrencyStats GetStats();
}

/// <summary>
///     Estatísticas de concorrência.
/// </summary>
public sealed class ConcurrencyStats
{
    public required int ActiveProbes { get; init; }
    public required int ActivePolling { get; init; }
    public required int QueuedRequests { get; init; }
    public required long TotalRequests { get; init; }
    public required long TotalRejections { get; init; }
    public required DateTimeOffset LastUpdated { get; init; }
}

/// <summary>
///     Implementação de controle de concorrência com múltiplos limites.
/// </summary>
public sealed class SemaphoreConcurrencyLimiter : IConcurrencyLimiter
{
    private readonly ILogger<SemaphoreConcurrencyLimiter> _logger;
    private readonly int _maxIdentityProbes;
    private readonly int _maxPollingDevices;
    private readonly int _maxGlobalRequestsPerSecond;

    private readonly SemaphoreSlim _identityProbeSemaphore;
    private readonly SemaphoreSlim _pollingSemaphore;
    private readonly SemaphoreSlim _globalRateSemaphore;

    private readonly ConcurrentDictionary<string, SemaphoreSlim> _keySemaphores = new();
    private readonly ConcurrentQueue<DateTimeOffset> _requestTimestamps = new();

    private long _totalRequests;
    private long _totalRejections;
    private int _activeProbes;
    private int _activePolling;

    private readonly object _statsLock = new();

    public SemaphoreConcurrencyLimiter(
        ILogger<SemaphoreConcurrencyLimiter> logger,
        int maxIdentityProbes = 64,
        int maxPollingDevices = 16,
        int maxGlobalRequestsPerSecond = 200)
    {
        _logger = logger;
        _maxIdentityProbes = maxIdentityProbes;
        _maxPollingDevices = maxPollingDevices;
        _maxGlobalRequestsPerSecond = maxGlobalRequestsPerSecond;

        _identityProbeSemaphore = new SemaphoreSlim(maxIdentityProbes, maxIdentityProbes);
        _pollingSemaphore = new SemaphoreSlim(maxPollingDevices, maxPollingDevices);
        _globalRateSemaphore = new SemaphoreSlim(maxGlobalRequestsPerSecond, maxGlobalRequestsPerSecond);
    }

    public async Task<T> ExecuteAsync<T>(string key, Func<Task<T>> work, CancellationToken ct)
    {
        // Determine which semaphore to use based on key prefix
        var (semaphore, maxCount) = GetSemaphoreForKey(key);

        _totalRequests++;

        // Try to acquire semaphore
        if (!await semaphore.WaitAsync(TimeSpan.FromSeconds(30), ct))
        {
            Interlocked.Increment(ref _totalRejections);
            _logger.LogWarning("Concurrency limit reached for key {Key}", key);
            throw new InvalidOperationException($"Concurrency limit reached for {key}");
        }

        try
        {
            // Track active operations
            if (key.StartsWith("probe:"))
            {
                Interlocked.Increment(ref _activeProbes);
            }
            else if (key.StartsWith("poll:"))
            {
                Interlocked.Increment(ref _activePolling);
            }

            // Execute work
            return await work();
        }
        finally
        {
            if (key.StartsWith("probe:"))
            {
                Interlocked.Decrement(ref _activeProbes);
            }
            else if (key.StartsWith("poll:"))
            {
                Interlocked.Decrement(ref _activePolling);
            }

            semaphore.Release();
        }
    }

    public ConcurrencyStats GetStats()
    {
        lock (_statsLock)
        {
            // Clean up old timestamps
            var cutoff = DateTimeOffset.UtcNow.AddSeconds(-60);
            while (_requestTimestamps.TryPeek(out var ts) && ts < cutoff)
            {
                _requestTimestamps.TryDequeue(out _);
            }

            return new ConcurrencyStats
            {
                ActiveProbes = _activeProbes,
                ActivePolling = _activePolling,
                QueuedRequests = _requestTimestamps.Count,
                TotalRequests = _totalRequests,
                TotalRejections = _totalRejections,
                LastUpdated = DateTimeOffset.UtcNow
            };
        }
    }

    private (SemaphoreSlim Semaphore, int MaxCount) GetSemaphoreForKey(string key)
    {
        if (key.StartsWith("probe:"))
        {
            return (_identityProbeSemaphore, _maxIdentityProbes);
        }
        else if (key.StartsWith("poll:"))
        {
            return (_pollingSemaphore, _maxPollingDevices);
        }

        // Default to global rate limiter
        return (_globalRateSemaphore, _maxGlobalRequestsPerSecond);
    }
}

/// <summary>
///     Rate limiter baseado em token bucket para controle de requisições por segundo.
/// </summary>
public sealed class TokenBucketRateLimiter : IDisposable
{
    private readonly ILogger<TokenBucketRateLimiter> _logger;
    private readonly int _maxTokens;
    private readonly double _refillRate; // tokens per second

    private double _tokens;
    private DateTimeOffset _lastRefill;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public TokenBucketRateLimiter(
        ILogger<TokenBucketRateLimiter> logger,
        int maxTokens = 200,
        double refillRatePerSecond = 200)
    {
        _logger = logger;
        _maxTokens = maxTokens;
        _refillRate = refillRatePerSecond;
        _tokens = maxTokens;
        _lastRefill = DateTimeOffset.UtcNow;
    }

    public async Task<bool> TryAcquireAsync(int tokens = 1, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);

        try
        {
            RefillTokens();

            if (_tokens >= tokens)
            {
                _tokens -= tokens;
                return true;
            }

            return false;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task WaitAsync(int tokens = 1, CancellationToken ct = default)
    {
        while (!await TryAcquireAsync(tokens, ct))
        {
            // Wait before retrying
            await Task.Delay(10, ct);
        }
    }

    private void RefillTokens()
    {
        var now = DateTimeOffset.UtcNow;
        var elapsed = (now - _lastRefill).TotalSeconds;
        var newTokens = elapsed * _refillRate;

        _tokens = Math.Min(_maxTokens, _tokens + newTokens);
        _lastRefill = now;
    }

    public void Dispose()
    {
        _lock.Dispose();
    }
}
