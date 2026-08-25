using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Domain.Entities;

namespace Inner.Monitoring.Application.Alerting;

/// <summary>
///     Interface para avaliador de alertas.
/// </summary>
public interface IAlertEvaluator
{
    /// <summary>
    ///     Avalia alertas para uma empresa após processamento de batch.
    /// </summary>
    Task EvaluateAlertsAsync(Guid companyId, CancellationToken ct);

    /// <summary>
    ///     Avalia alertas para um asset específico.
    /// </summary>
    Task EvaluateAssetAlertsAsync(Guid companyId, Guid assetId, CancellationToken ct);

    /// <summary>
    ///     Obtém regras de alerta configuradas.
    /// </summary>
    Task<IReadOnlyList<AlertRule>> GetRulesAsync(Guid companyId, CancellationToken ct);

    /// <summary>
    ///     Atualiza uma regra de alerta.
    /// </summary>
    Task UpdateRuleAsync(AlertRule rule, CancellationToken ct);
}

/// <summary>
///     Regra de alerta configurável.
/// </summary>
public sealed class AlertRule
{
    public Guid Id { get; init; }
    public required Guid CompanyId { get; init; }
    public required string Name { get; init; }
    public required AlertRuleType Type { get; init; }
    public required bool Enabled { get; init; }
    public required int Priority { get; init; }
    public required string MetricKey { get; init; }
    public required AlertCondition Condition { get; init; }
    public required double Threshold { get; init; }
    public string? AssetType { get; init; }
    public string? AssetId { get; init; }
    public string? DimensionFilter { get; init; }
    public int EvaluationWindowSeconds { get; init; } = 300;
    public int MinSamplesRequired { get; init; } = 1;
    public required AlertSeverity Severity { get; init; }
    public required string MessageTemplate { get; init; }
    public IReadOnlyDictionary<string, string>? Labels { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>
///     Tipo de regra de alerta.
/// </summary>
public enum AlertRuleType
{
    Threshold,
    Anomaly,
    StateChange,
    Missing,
    RateOfChange
}

/// <summary>
///     Condição de avaliação do alerta.
/// </summary>
public enum AlertCondition
{
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equal,
    NotEqual,
    Absent
}

/// <summary>
///     Severidade do alerta.
/// </summary>
public enum AlertSeverity
{
    Info,
    Warning,
    Critical
}

/// <summary>
///     Resultado da avaliação de um alerta.
/// </summary>
public sealed class AlertEvaluation
{
    public required Guid RuleId { get; init; }
    public required Guid AssetId { get; init; }
    public required string AssetName { get; init; }
    public required Guid CompanyId { get; init; }
    public required string MetricKey { get; init; }
    public required double CurrentValue { get; init; }
    public required double Threshold { get; init; }
    public required AlertCondition Condition { get; init; }
    public required bool Triggered { get; init; }
    public AlertSeverity Severity { get; init; }
    public required string Message { get; init; }
    public DateTimeOffset EvaluatedAt { get; init; }
    public string? Details { get; init; }
}

/// <summary>
///     Estatísticas de alertas.
/// </summary>
public sealed class AlertStatistics
{
    public required Guid CompanyId { get; init; }
    public required int TotalRules { get; init; }
    public required int ActiveAlerts { get; init; }
    public required int TriggeredAlerts { get; init; }
    public required int ResolvedAlerts { get; init; }
    public required int AcknowledgedAlerts { get; init; }
    public required DateTimeOffset LastEvaluationAt { get; init; }
    public IReadOnlyDictionary<AlertSeverity, int> AlertsBySeverity { get; init; } = new Dictionary<AlertSeverity, int>();
}
