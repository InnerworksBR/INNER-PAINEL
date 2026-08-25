# Fase 6 - Operação Avançada

## Visão Geral

A Fase 6 implementa serviços de operação avançada para o sistema de monitoramento:

1. **Durable Commands** - Sistema de comandos duráveis
2. **Rollup Service** - Agregação de métricas
3. **Retention Service** - Políticas de retenção de dados
4. **Signed Updates** - Atualizações assinadas
5. **Alerting** - Sistema de alertas

---

## 1. Durable Commands

### Interface `ICommandHandler`

```csharp
public interface ICommandHandler
{
    string CommandType { get; }
    string Description { get; }
    int DefaultTimeoutSeconds { get; }
    Task<CommandResult> ExecuteAsync(CommandEnvelope envelope, CancellationToken ct);
}
```

### Comandos Implementados

| Comando | Handler | Timeout | Descrição |
|---------|---------|---------|-----------|
| `collect_now` | `CollectNowHandler` | 300s | Força coleta imediata |
| `diagnostics_run` | `DiagnosticsRunHandler` | 60s | Executa diagnóstico |
| `config_refresh` | `ConfigRefreshHandler` | 30s | Recarrega configuração |
| `outbox_status` | `OutboxStatusHandler` | 10s | Status da outbox |
| `service_status` | `ServiceStatusHandler` | 5s | Status do serviço |
| `snmp_probe` | `SnmpProbeHandler` | 30s | Probe SNMP ad-hoc |

### Envelope de Comando

```csharp
public sealed class CommandEnvelope
{
    public Guid CommandId { get; init; }
    public Guid SourceId { get; init; }
    public string CommandType { get; init; }
    public Guid CompanyId { get; init; }
    public DateTimeOffset ExpiresAt { get; init; }
    public int Priority { get; init; }
    public IReadOnlyDictionary<string, object>? Parameters { get; init; }
}
```

### Resultado de Comando

```csharp
public sealed class CommandResult
{
    public Guid CommandId { get; init; }
    public CommandStatus Status { get; init; }
    public string? ResultJson { get; init; }
    public string? ErrorCode { get; init; }
    public bool ShouldRetry { get; init; }
    public TimeSpan Duration { get; init; }
}
```

### Exemplo de Uso

```csharp
// Criar envelope
var envelope = new CommandEnvelope
{
    CommandId = Guid.NewGuid(),
    SourceId = sourceId,
    CommandType = "collect_now",
    CompanyId = companyId,
    ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
    Parameters = new Dictionary<string, object>
    {
        ["force"] = true
    }
};

// Obter handler correto
var handler = commandHandlers.FirstOrDefault(h => h.CommandType == envelope.CommandType);

// Executar
var result = await handler.ExecuteAsync(envelope, ct);
```

---

## 2. Rollup Service

### Interface `IRollupService`

```csharp
public interface IRollupService
{
    Task Build5MinuteRollupsAsync(DateTime bucketStart, CancellationToken ct);
    Task BuildHourlyRollupsAsync(DateTime bucketStart, CancellationToken ct);
    Task RunPendingRollupsAsync(CancellationToken ct);
}
```

### Agregações Disponíveis

| Agregação | Descrição |
|-----------|-----------|
| `Min` | Valor mínimo |
| `Max` | Valor máximo |
| `Avg` | Média |
| `Sum` | Soma |
| `Count` | Contagem |
| `Last` | Último valor |
| `First` | Primeiro valor |
| `Rate` | Taxa de variação |

### Processamento

1. **Rollup de 5 minutos**
   - Executado a cada 5 minutos
   - Agrega samples individuais
   - Calcula: min, max, avg, sum, count, last

2. **Rollup Horário**
   - Executado a cada hora
   - Agrega rollups de 5 minutos
   - Mantém valores de rollups anteriores

### Exemplo

```csharp
var rollupService = serviceProvider.GetRequiredService<IRollupService>();

// Executar rollup específico
await rollupService.Build5MinuteRollupsAsync(DateTime.UtcNow.AddMinutes(-5), ct);

// Executar todos os rollups pendentes
await rollupService.RunPendingRollupsAsync(ct);
```

---

## 3. Retention Service

### Interface `IRetentionService`

```csharp
public interface IRetentionService
{
    Task ApplyRetentionAsync(CancellationToken ct);
    Task CreatePartitionsAsync(int daysAhead, CancellationToken ct);
    Task DropOldPartitionsAsync(CancellationToken ct);
    Task<RetentionStatistics> GetStatisticsAsync(CancellationToken ct);
}
```

### Política de Retenção

| Classe | Retenção | Particionamento |
|--------|----------|-----------------|
| Realtime | 7 dias | Diário |
| Standard | 30 dias | Diário |
| Rollup 5min | 180 dias | Diário |
| Rollup 1h | 730 dias | Diário |
| Eventos | 730 dias | Diário |
| Audit Log | 365 dias | Diário |

### Exemplo

```csharp
var retentionService = serviceProvider.GetRequiredService<IRetentionService>();

// Ver estatísticas
var stats = await retentionService.GetStatisticsAsync(ct);

// Aplicar retenção
await retentionService.ApplyRetentionAsync(ct);

// Criar partições futuras
await retentionService.CreatePartitionsAsync(7, ct);

// Remover partições antigas
await retentionService.DropOldPartitionsAsync(ct);
```

### Particionamento

O sistema usa particionamento PostgreSQL por data:

```
monitoring.metric_samples
  ├── p_20240101
  ├── p_20240102
  └── ...
```

---

## 4. Signed Updates

### Interface `ISignedUpdateService`

```csharp
public interface ISignedUpdateService
{
    Task<UpdateCheckResult> CheckForUpdateAsync(string currentVersion, CancellationToken ct);
    Task<UpdatePackage> DownloadAndValidateAsync(UpdateManifest manifest, CancellationToken ct);
    Task ApplyUpdateAsync(UpdatePackage package, IProgress<int>? progress = null, CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct);
}
```

### Manifesto de Update

```json
{
  "version": "1.2.0",
  "download_url": "https://updates.inner.com/1.2.0/package.zip",
  "sha256_hash": "abc123...",
  "rsa_signature": "xyz789...",
  "public_key_pem": "-----BEGIN RSA PUBLIC KEY-----...",
  "package_size_bytes": 52428800,
  "release_notes": "Bug fixes and improvements",
  "published_at": "2024-01-15T00:00:00Z",
  "mandatory_after": "2024-02-01T00:00:00Z",
  "is_delta": false,
  "checksums": {
    "agent.exe": "hash1...",
    "config.json": "hash2..."
  }
}
```

### Fluxo de Update

1. **Check**: Verificar se há atualização disponível
2. **Download**: Baixar pacote do servidor
3. **Validate**:
   - Verificar hash SHA256
   - Validar assinatura RSA
4. **Backup**: Salvar versão atual para rollback
5. **Apply**: Substituir arquivos
6. **Verify**: Confirmar instalação

### Rollback

Se a atualização falhar:
1. Detectar falha
2. Restaurar arquivos do backup
3. Manter versão anterior ativa

---

## 5. Alerting

### Interface `IAlertEvaluator`

```csharp
public interface IAlertEvaluator
{
    Task EvaluateAlertsAsync(Guid companyId, CancellationToken ct);
    Task EvaluateAssetAlertsAsync(Guid companyId, Guid assetId, CancellationToken ct);
    Task<IReadOnlyList<AlertRule>> GetRulesAsync(Guid companyId, CancellationToken ct);
}
```

### Estrutura de Regra

```csharp
public sealed class AlertRule
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public AlertRuleType Type { get; init; }  // Threshold, Anomaly, StateChange, Missing
    public required string MetricKey { get; init; }
    public required AlertCondition Condition { get; init; }  // GreaterThan, LessThan, etc.
    public required double Threshold { get; init; }
    public required AlertSeverity Severity { get; init; }  // Info, Warning, Critical
    public required string MessageTemplate { get; init; }
}
```

### Tipos de Condição

| Condição | Descrição |
|----------|-----------|
| `GreaterThan` | Valor > threshold |
| `GreaterThanOrEqual` | Valor >= threshold |
| `LessThan` | Valor < threshold |
| `LessThanOrEqual` | Valor <= threshold |
| `Equal` | Valor == threshold |
| `Absent` | Métrica não existe |

### Regras Padrão

| Nome | Métrica | Condição | Threshold | Severidade |
|------|---------|----------|-----------|------------|
| CPU Alto | `system.cpu.usage` | > | 90% | Warning |
| CPU Crítico | `system.cpu.usage` | > | 95% | Critical |
| Memória Alta | `system.memory.usage` | > | 85% | Warning |
| Disco Cheio | `system.disk.usage` | > | 90% | Critical |

### Exemplo de Avaliação

```csharp
var evaluator = serviceProvider.GetRequiredService<IAlertEvaluator>();

// Após processar batch
await evaluator.EvaluateAlertsAsync(companyId, ct);

// Para um asset específico
await evaluator.EvaluateAssetAlertsAsync(companyId, assetId, ct);
```

---

## Configuração

###appsettings.json

```json
{
  "Monitoring": {
    "Commands": {
      "DefaultTimeoutSeconds": 60,
      "MaxRetries": 3
    },
    "Rollup": {
      "Enabled": true,
      "IntervalMinutes": 5
    },
    "Retention": {
      "RealtimeDays": 7,
      "StandardDays": 30,
      "Rollup5mDays": 180,
      "Rollup1hDays": 730,
      "EventDays": 730,
      "PartitionDaysAhead": 7
    },
    "Updates": {
      "BaseUrl": "https://updates.inner.com",
      "CheckIntervalHours": 24,
      "AutoUpdate": true
    },
    "Alerting": {
      "Enabled": true,
      "EvaluationIntervalSeconds": 60
    }
  }
}
```

---

## Integração com Workers

### Cloud Worker

```csharp
// Program.cs
builder.Services.AddHostedService<RollupBackgroundService>();
builder.Services.AddHostedService<RetentionBackgroundService>();

// Workers são implementados como BackgroundService
```

### Cron Jobs Recomendados

| Job | Frequência | Responsabilidade |
|-----|------------|------------------|
| Rollup5m | A cada 5 min | Agregar métricas |
| Rollup1h | A cada hora | Agregar rollups |
| Retention | Diário | Aplicar política |
| PartitionCreate | Diário | Criar partições |
| AlertEval | A cada 1 min | Avaliar alertas |

---

## Métricas Operacionais

### Health Checks

```
/health/ready  - Pronto para receber conexões
/health/live    - Processo está rodando
```

### Métricas Exportadas

| Métrica | Descrição |
|---------|-----------|
| `monitoring.commands.total` | Total de comandos processados |
| `monitoring.commands.duration` | Duração de comandos |
| `monitoring.rollup.samples` | Amostras agregadas |
| `monitoring.retention.deleted` | Registros deletados |
| `monitoring.alerts.triggered` | Alertas disparados |
