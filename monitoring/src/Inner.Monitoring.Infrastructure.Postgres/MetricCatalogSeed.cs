using Inner.Monitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Infrastructure.Postgres;

/// <summary>
///     Seed das métricas padrão do catálogo.
/// </summary>
public static class MetricCatalogSeed
{
    /// <summary>
    ///     Métricas padrão do Inner Agent (Windows Host).
    /// </summary>
    public static readonly MetricDefinition[] AgentMetrics =
    [
        // CPU
        CreateMetric("system.cpu.usage_percent", "CPU Usage", "Percentual de uso de CPU", "double", "%", "gauge", "avg", "realtime"),
        CreateMetric("system.cpu.idle_percent", "CPU Idle", "Percentual de CPU ociosa", "double", "%", "gauge", "avg", "realtime"),
        CreateMetric("system.cpu.user_percent", "CPU User", "Percentual de CPU em modo usuário", "double", "%", "gauge", "avg", "realtime"),
        CreateMetric("system.cpu.kernel_percent", "CPU Kernel", "Percentual de CPU em modo kernel", "double", "%", "gauge", "avg", "realtime"),

        // Memória
        CreateMetric("system.memory.total_bytes", "Memory Total", "Memória total", "long", "B", "gauge", "last", "standard"),
        CreateMetric("system.memory.available_bytes", "Memory Available", "Memória disponível", "long", "B", "gauge", "last", "standard"),
        CreateMetric("system.memory.used_bytes", "Memory Used", "Memória em uso", "long", "B", "gauge", "last", "standard"),
        CreateMetric("system.memory.usage_percent", "Memory Usage", "Percentual de uso de memória", "double", "%", "gauge", "avg", "realtime"),

        // Discos
        CreateMetric("system.disk.total_bytes", "Disk Total", "Espaço total do disco", "long", "B", "gauge", "last", "standard"),
        CreateMetric("system.disk.free_bytes", "Disk Free", "Espaço livre do disco", "long", "B", "gauge", "last", "standard"),
        CreateMetric("system.disk.used_bytes", "Disk Used", "Espaço usado do disco", "long", "B", "gauge", "last", "standard"),
        CreateMetric("system.disk.usage_percent", "Disk Usage", "Percentual de uso do disco", "double", "%", "gauge", "avg", "realtime"),

        // Sistema
        CreateMetric("system.uptime.seconds", "Uptime", "Tempo desde último boot em segundos", "long", "s", "counter", "last", "standard"),
        CreateMetric("system.boots.count", "Boot Count", "Número de boots", "long", "count", "counter", "last", "inventory"),

        // Informações do Host
        CreateMetric("system.hostname", "Hostname", "Nome do host", "string", "", "inventory", "last", "inventory"),
        CreateMetric("system.os.name", "OS Name", "Nome do sistema operacional", "string", "", "inventory", "last", "inventory"),
        CreateMetric("system.os.version", "OS Version", "Versão do sistema operacional", "string", "", "inventory", "last", "inventory"),
        CreateMetric("system.os.build", "OS Build", "Build do sistema operacional", "string", "", "inventory", "last", "inventory"),

        // Hyper-V
        CreateMetric("hyperv.host.vm.count", "VM Count", "Número de máquinas virtuais", "long", "count", "gauge", "last", "standard"),
        CreateMetric("hyperv.vm.memory.assigned_bytes", "VM Memory Assigned", "Memória atribuída à VM", "long", "B", "gauge", "last", "standard"),
        CreateMetric("hyperv.vm.cpu.usage_percent", "VM CPU Usage", "Percentual de CPU da VM", "double", "%", "gauge", "avg", "realtime"),
        CreateMetric("hyperv.vm.state", "VM State", "Estado da VM (1=running,2=stopped,etc)", "long", "", "state", "last", "standard"),
    ];

    /// <summary>
    ///     Métricas padrão do Collector (SNMP).
    /// </summary>
    public static readonly MetricDefinition[] CollectorMetrics =
    [
        // MIB-II Sistema
        CreateMetric("snmp.system.sysUpTime", "System Uptime", "Tempo desde último SNMP restart", "long", "cs", "counter", "last", "standard"),
        CreateMetric("snmp.system.sysContact", "System Contact", "Contato do sistema", "string", "", "inventory", "last", "inventory"),
        CreateMetric("snmp.system.sysName", "System Name", "Nome do sistema", "string", "", "inventory", "last", "inventory"),
        CreateMetric("snmp.system.sysLocation", "System Location", "Localização do sistema", "string", "", "inventory", "last", "inventory"),

        // Interfaces
        CreateMetric("snmp.if.in_octets", "Interface In Octets", "Octetos de entrada", "long", "B", "counter", "sum", "standard"),
        CreateMetric("snmp.if.out_octets", "Interface Out Octets", "Octetos de saída", "long", "B", "counter", "sum", "standard"),
        CreateMetric("snmp.if.in_errors", "Interface In Errors", "Erros de entrada", "long", "count", "counter", "sum", "standard"),
        CreateMetric("snmp.if.out_errors", "Interface Out Errors", "Erros de saída", "long", "count", "counter", "sum", "standard"),
        CreateMetric("snmp.if.oper_status", "Interface Status", "Status operacional (1=up,2=down)", "long", "", "state", "last", "standard"),
        CreateMetric("snmp.if.admin_status", "Interface Admin Status", "Status administrativo", "long", "", "state", "last", "standard"),
        CreateMetric("snmp.if.speed", "Interface Speed", "Velocidade da interface em bps", "long", "bps", "gauge", "last", "standard"),
    ];

    private static MetricDefinition CreateMetric(
        string key,
        string displayName,
        string description,
        string valueType,
        string unit,
        string semanticType,
        string aggregation,
        string retentionClass)
    {
        return MetricDefinition.Create(
            key,
            displayName,
            description,
            valueType,
            unit,
            semanticType,
            aggregation,
            retentionClass,
            introducedSchemaVersion: 1);
    }

    /// <summary>
    ///     Executa o seed das métricas no banco.
    /// </summary>
    public static async Task SeedAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<MonitoringDbContext>>();

        try
        {
            // Verificar se já existe
            var existingCount = await db.MetricDefinitions.CountAsync(cancellationToken);
            if (existingCount > 0)
            {
                logger.LogInformation("Metric catalog already seeded with {Count} metrics", existingCount);
                return;
            }

            // Inserir métricas do agente
            db.MetricDefinitions.AddRange(AgentMetrics);

            // Inserir métricas do collector
            db.MetricDefinitions.AddRange(CollectorMetrics);

            await db.SaveChangesAsync(cancellationToken);

            logger.LogInformation("Seeded {AgentCount} agent metrics and {CollectorCount} collector metrics",
                AgentMetrics.Length, CollectorMetrics.Length);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to seed metric catalog");
            throw;
        }
    }
}
