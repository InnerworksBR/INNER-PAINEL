using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Application.Commands;

/// <summary>
///     Envelope de um comando enviado para execução.
/// </summary>
public sealed class CommandEnvelope
{
    public required Guid CommandId { get; init; }
    public required Guid SourceId { get; init; }
    public required string CommandType { get; init; }
    public required Guid CompanyId { get; init; }
    public required Guid RequestedBy { get; init; }
    public required DateTimeOffset RequestedAt { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public int Priority { get; init; } = 100;
    public int AttemptNumber { get; init; } = 1;
    public IReadOnlyDictionary<string, object>? Parameters { get; init; }
    public CancellationToken CancellationToken { get; init; }
}

/// <summary>
///     Resultado da execução de um comando.
/// </summary>
public sealed class CommandResult
{
    public required Guid CommandId { get; init; }
    public required CommandStatus Status { get; init; }
    public string? ResultJson { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public DateTimeOffset CompletedAt { get; init; }
    public TimeSpan Duration { get; init; }
    public bool ShouldRetry { get; init; }
}

/// <summary>
///     Status de execução de um comando.
/// </summary>
public enum CommandStatus
{
    Pending,
    Running,
    Succeeded,
    Failed,
    Cancelled
}

/// <summary>
///     Interface para handlers de comandos.
/// </summary>
public interface ICommandHandler
{
    /// <summary>
    ///     Tipo de comando suportado por este handler.
    /// </summary>
    string CommandType { get; }

    /// <summary>
    ///     Descrição do comando.
    /// </summary>
    string Description { get; }

    /// <summary>
    ///     Timeout padrão para este comando em segundos.
    /// </summary>
    int DefaultTimeoutSeconds { get; }

    /// <summary>
    ///     Executa o comando.
    /// </summary>
    Task<CommandResult> ExecuteAsync(CommandEnvelope envelope, CancellationToken ct);
}

/// <summary>
///     Resultado do comando collect_now.
/// </summary>
public sealed class CollectNowResult
{
    public Guid BatchId { get; init; }
    public int RecordsCollected { get; init; }
    public DateTimeOffset CollectedAt { get; init; }
    public TimeSpan Duration { get; init; }
    public IReadOnlyList<string> CollectorsRun { get; init; } = [];
    public IReadOnlyList<string> CollectorsSkipped { get; init; } = [];
}

/// <summary>
///     Resultado do comando diagnostics_run.
/// </summary>
public sealed class DiagnosticsResult
{
    public Guid DiagnosticsRunId { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset CompletedAt { get; init; }
    public IReadOnlyList<DiagnosticCheck> Checks { get; init; } = [];
}

/// <summary>
///     Resultado de uma verificação de diagnóstico.
/// </summary>
public sealed class DiagnosticCheck
{
    public required string Name { get; init; }
    public required DiagnosticStatus Status { get; init; }
    public string? Message { get; init; }
    public TimeSpan Duration { get; init; }
    public IReadOnlyDictionary<string, object>? Details { get; init; }
}

/// <summary>
///     Status de uma verificação de diagnóstico.
/// </summary>
public enum DiagnosticStatus
{
    Pass,
    Warning,
    Fail,
    Skip
}

/// <summary>
///     Resultado do comando config_refresh.
/// </summary>
public sealed class ConfigRefreshResult
{
    public long NewConfigVersion { get; init; }
    public long PreviousConfigVersion { get; init; }
    public bool ConfigChanged { get; init; }
    public DateTimeOffset RefreshedAt { get; init; }
    public IReadOnlyDictionary<string, object>? Changes { get; init; }
}

/// <summary>
///     Resultado do comando outbox_status.
/// </summary>
public sealed class OutboxStatusResult
{
    public int PendingCount { get; init; }
    public int ProcessingCount { get; init; }
    public int FailedCount { get; init; }
    public long OldestPendingAgeSeconds { get; init; }
    public long TotalPendingBytes { get; init; }
    public DateTimeOffset OldestPendingTimestamp { get; init; }
}

/// <summary>
///     Resultado do comando service_status.
/// </summary>
public sealed class ServiceStatusResult
{
    public required string ServiceName { get; init; }
    public required ServiceState State { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public TimeSpan Uptime { get; init; }
    public double CpuUsagePercent { get; init; }
    public long MemoryUsageBytes { get; init; }
    public IReadOnlyDictionary<string, MetricValue> Metrics { get; init; } = new Dictionary<string, MetricValue>();
    public IReadOnlyList<string> Warnings { get; init; } = [];
}

/// <summary>
///     Estado do serviço.
/// </summary>
public enum ServiceState
{
    Running,
    Stopped,
    Starting,
    Stopping,
    Paused,
    Degraded
}

/// <summary>
///     Valor de uma métrica.
/// </summary>
public sealed class MetricValue
{
    public required object Value { get; init; }
    public required string Unit { get; init; }
    public DateTimeOffset SampledAt { get; init; }
}

/// <summary>
///     Resultado do comando snmp_probe.
/// </summary>
public sealed class SnmpProbeResult
{
    public required string TargetIp { get; init; }
    public int TargetPort { get; init; }
    public required ProbeStatus Status { get; init; }
    public TimeSpan ResponseTime { get; init; }
    public string? SnmpVersion { get; init; }
    public string? SystemDescription { get; init; }
    public string? SystemOid { get; init; }
    public string? ErrorMessage { get; init; }
    public IReadOnlyDictionary<string, string>? Variables { get; init; }
}

/// <summary>
///     Status de um probe SNMP.
/// </summary>
public enum ProbeStatus
{
    Success,
    Timeout,
    AuthenticationError,
    Unsupported,
    NetworkError
}
