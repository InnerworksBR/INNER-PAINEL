using System.Text.Json;
using System.Text.RegularExpressions;
using Inner.Monitoring.Contracts.Enums;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Alerting;

/// <summary>
///     Implementação do avaliador de alertas.
///     Versão simplificada que usa delegates para acesso ao banco.
/// </summary>
public sealed class AlertEvaluator : IAlertEvaluator
{
    private readonly ILogger<AlertEvaluator> _logger;
    private readonly Func<Guid, Task<List<AlertRule>>> _getRulesAsync;
    private readonly Func<Guid, Guid, Task<List<AlertMetric>>> _getAssetMetricsAsync;
    private readonly Action<AlertEvaluation> _saveAlertAsync;

    // Cache em memória das regras para evitar hits constantes no banco
    private readonly Dictionary<Guid, List<AlertRule>> _rulesCache = new();
    private DateTimeOffset _rulesCacheExpiry = DateTimeOffset.MinValue;

    public AlertEvaluator(
        ILogger<AlertEvaluator> logger,
        Func<Guid, Task<List<AlertRule>>>? getRulesAsync = null,
        Func<Guid, Guid, Task<List<AlertMetric>>>? getAssetMetricsAsync = null,
        Action<AlertEvaluation>? saveAlertAsync = null)
    {
        _logger = logger;
        _getRulesAsync = getRulesAsync ?? GetDefaultRulesAsync;
        _getAssetMetricsAsync = getAssetMetricsAsync ?? DefaultGetAssetMetricsAsync;
        _saveAlertAsync = saveAlertAsync ?? (_ => { });
    }

    public async Task EvaluateAlertsAsync(Guid companyId, CancellationToken ct)
    {
        _logger.LogDebug("Avaliando alertas para empresa {CompanyId}", companyId);

        try
        {
            var rules = await GetRulesAsync(companyId, ct);
            if (rules.Count == 0)
            {
                return;
            }

            // Agrupar regras por asset
            var rulesByAsset = rules
                .Where(r => r.AssetId != null)
                .GroupBy(r => r.AssetId!)
                .ToList();

            foreach (var group in rulesByAsset)
            {
                if (Guid.TryParse(group.Key, out var assetId))
                {
                    await EvaluateAssetAlertsInternalAsync(companyId, assetId, group.ToList(), ct);
                }
            }

            // Avaliar regras sem asset específico
            var genericRules = rules.Where(r => r.AssetId == null).ToList();
            if (genericRules.Count > 0)
            {
                // Em implementação real, buscaria todos os assets
                _logger.LogDebug("Regras genéricas pendentes de avaliação: {Count}", genericRules.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao avaliar alertas para empresa {CompanyId}", companyId);
        }
    }

    public async Task EvaluateAssetAlertsAsync(Guid companyId, Guid assetId, CancellationToken ct)
    {
        var rules = await GetRulesAsync(companyId, ct);
        var assetRules = rules
            .Where(r => r.AssetId == null || r.AssetId == assetId.ToString())
            .ToList();

        await EvaluateAssetAlertsInternalAsync(companyId, assetId, assetRules, ct);
    }

    public async Task<IReadOnlyList<AlertRule>> GetRulesAsync(Guid companyId, CancellationToken ct)
    {
        // Verificar cache
        if (_rulesCacheExpiry > DateTimeOffset.UtcNow && _rulesCache.TryGetValue(companyId, out var cachedRules))
        {
            return cachedRules;
        }

        var rules = await _getRulesAsync(companyId);

        // Se não encontrou regras configuradas, usar regras padrão
        if (rules.Count == 0)
        {
            rules = GetDefaultRulesList(companyId);
        }

        // Atualizar cache
        _rulesCache[companyId] = rules;
        _rulesCacheExpiry = DateTimeOffset.UtcNow.AddMinutes(5);

        return rules;
    }

    public Task UpdateRuleAsync(AlertRule rule, CancellationToken ct)
    {
        _logger.LogInformation("Atualizando regra de alerta {RuleId}", rule.Id);

        // Invalidar o cache
        _rulesCache.Remove(rule.CompanyId);
        _rulesCacheExpiry = DateTimeOffset.MinValue;

        return Task.CompletedTask;
    }

    private async Task EvaluateAssetAlertsInternalAsync(
        Guid companyId,
        Guid assetId,
        List<AlertRule> rules,
        CancellationToken ct)
    {
        // Obter métricas atuais do asset
        var currentMetrics = await _getAssetMetricsAsync(companyId, assetId);

        foreach (var rule in rules.Where(r => r.Enabled))
        {
            var evaluation = EvaluateRule(rule, assetId, currentMetrics);

            if (evaluation.Triggered)
            {
                _saveAlertAsync(evaluation);
            }
        }
    }

    private AlertEvaluation EvaluateRule(AlertRule rule, Guid assetId, List<AlertMetric> metrics)
    {
        var metric = metrics.FirstOrDefault(m => m.MetricKey == rule.MetricKey);

        if (metric == null)
        {
            // Métrica não encontrada
            if (rule.Condition == AlertCondition.Absent)
            {
                return new AlertEvaluation
                {
                    RuleId = rule.Id,
                    AssetId = assetId,
                    AssetName = metric?.AssetName ?? "",
                    CompanyId = rule.CompanyId,
                    MetricKey = rule.MetricKey,
                    CurrentValue = 0,
                    Threshold = rule.Threshold,
                    Condition = rule.Condition,
                    Triggered = true,
                    Severity = rule.Severity,
                    Message = FormatMessage(rule.MessageTemplate, rule.MetricKey, assetId.ToString(), 0, rule.Threshold),
                    EvaluatedAt = DateTimeOffset.UtcNow,
                    Details = "Métrica não encontrada"
                };
            }

            return CreateNonTriggeredEvaluation(rule, assetId);
        }

        var currentValue = metric.Value;
        var triggered = EvaluateCondition(currentValue, rule.Condition, rule.Threshold);

        return new AlertEvaluation
        {
            RuleId = rule.Id,
            AssetId = assetId,
            AssetName = metric.AssetName,
            CompanyId = rule.CompanyId,
            MetricKey = rule.MetricKey,
            CurrentValue = currentValue,
            Threshold = rule.Threshold,
            Condition = rule.Condition,
            Triggered = triggered,
            Severity = rule.Severity,
            Message = FormatMessage(rule.MessageTemplate, rule.MetricKey, metric.AssetName, currentValue, rule.Threshold),
            EvaluatedAt = DateTimeOffset.UtcNow,
            Details = JsonSerializer.Serialize(new { metric.Quality, metric.CollectedAt })
        };
    }

    private static bool EvaluateCondition(double value, AlertCondition condition, double threshold)
    {
        return condition switch
        {
            AlertCondition.GreaterThan => value > threshold,
            AlertCondition.GreaterThanOrEqual => value >= threshold,
            AlertCondition.LessThan => value < threshold,
            AlertCondition.LessThanOrEqual => value <= threshold,
            AlertCondition.Equal => Math.Abs(value - threshold) < 0.0001,
            AlertCondition.NotEqual => Math.Abs(value - threshold) >= 0.0001,
            AlertCondition.Absent => false, // Handled separately
            _ => false
        };
    }

    private static AlertEvaluation CreateNonTriggeredEvaluation(AlertRule rule, Guid assetId)
    {
        return new AlertEvaluation
        {
            RuleId = rule.Id,
            AssetId = assetId,
            AssetName = "",
            CompanyId = rule.CompanyId,
            MetricKey = rule.MetricKey,
            CurrentValue = 0,
            Threshold = rule.Threshold,
            Condition = rule.Condition,
            Triggered = false,
            Severity = rule.Severity,
            Message = "",
            EvaluatedAt = DateTimeOffset.UtcNow
        };
    }

    private static string FormatMessage(string template, string metric, string asset, double value, double threshold)
    {
        return template
            .Replace("{metric}", metric)
            .Replace("{asset}", asset)
            .Replace("{value}", value.ToString("F2"))
            .Replace("{threshold}", threshold.ToString("F2"));
    }

    private static Task<List<AlertMetric>> DefaultGetAssetMetricsAsync(Guid companyId, Guid assetId)
    {
        return Task.FromResult(new List<AlertMetric>());
    }

    private static Task<List<AlertRule>> GetDefaultRulesAsync(Guid companyId)
    {
        return Task.FromResult(GetDefaultRulesList(companyId));
    }

    private static List<AlertRule> GetDefaultRulesList(Guid companyId)
    {
        return new List<AlertRule>
        {
            new()
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Name = "CPU Alto",
                Type = AlertRuleType.Threshold,
                Enabled = true,
                Priority = 10,
                MetricKey = "system.cpu.usage",
                Condition = AlertCondition.GreaterThan,
                Threshold = 90,
                Severity = AlertSeverity.Warning,
                MessageTemplate = "CPU alto em {asset}: {value}% (limite: {threshold}%)",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Name = "CPU Crítico",
                Type = AlertRuleType.Threshold,
                Enabled = true,
                Priority = 5,
                MetricKey = "system.cpu.usage",
                Condition = AlertCondition.GreaterThan,
                Threshold = 95,
                Severity = AlertSeverity.Critical,
                MessageTemplate = "CPU crítico em {asset}: {value}% (limite: {threshold}%)",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Name = "Memória Alta",
                Type = AlertRuleType.Threshold,
                Enabled = true,
                Priority = 10,
                MetricKey = "system.memory.usage",
                Condition = AlertCondition.GreaterThan,
                Threshold = 85,
                Severity = AlertSeverity.Warning,
                MessageTemplate = "Memória alta em {asset}: {value}% (limite: {threshold}%)",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Name = "Disco Cheio",
                Type = AlertRuleType.Threshold,
                Enabled = true,
                Priority = 5,
                MetricKey = "system.disk.usage",
                Condition = AlertCondition.GreaterThan,
                Threshold = 90,
                Severity = AlertSeverity.Critical,
                MessageTemplate = "Disco quase cheio em {asset}: {value}% (limite: {threshold}%)",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }
        };
    }
}

/// <summary>
///     Dados de métrica para avaliação de alertas.
/// </summary>
public sealed class AlertMetric
{
    public required string MetricKey { get; init; }
    public required string AssetName { get; init; }
    public required double Value { get; init; }
    public string Quality { get; init; } = "good";
    public DateTimeOffset CollectedAt { get; init; }
}
