# Fase 5 - Hyper-V

## Visão Geral

A Fase 5 implementa o coletor Hyper-V para o Agent Windows, permitindo monitoramento de máquinas virtuais Hyper-V.

## Componentes

### Interface `IHyperVCollector`

```csharp
public interface IHyperVCollector : IObservationCollector
{
    Task<HyperVInventory> GetInventoryAsync(CancellationToken ct);
    Task<IEnumerable<VmMetrics>> GetVmMetricsAsync(CancellationToken ct);
    Task<bool> IsAvailableAsync(CancellationToken ct);
}
```

### Estruturas de Dados

#### `HyperVInventory`
Inventário completo do host Hyper-V:
- Identificação do host (SMBIOS UUID, hostname)
- Contagem de processadores e memória total
- Lista de VMs, switches e discos virtuais

#### `VmMetrics`
Métricas de uma VM individual:
- CPU usage (%)
- Memória assigned/observed
- Uptime (segundos)
- State (Running/Off/Saved/etc)
- Network/Disk throughput

#### Enumerações
- `VmState`: Running, Off, Paused, Saved, Starting, etc.
- `SwitchType`: Internal, External, Private
- `DiskType`: Vhd, Vhdx, PassThrough

## Coleta WMI/CIM

### Namespace
```
root\virtualization\v2
```

### Classes WMI Utilizadas

| Classe | Propósito |
|--------|-----------|
| `Msvm_ComputerSystem` | Lista de VMs e estado |
| `Msvm_VirtualSystemSettingData` | Configurações da VM |
| `Msvm_Processor` | Métricas de CPU |
| `Msvm_Memory` | Métricas de memória |
| `Msvm_EthernetSwitch` | Switches virtuais |
| `Msvm_EthernetPortAllocationSettingData` | Portas de switch |
| `Msvm_StorageAllocationSettingData` | Discos virtuais |
| `Msvm_MetricDef` | Definições de métricas |

## Identidade Hyper-V

### Host
- **Primary ID**: SMBIOS UUID
- **Fallback**: Hostname
- **Source ID**: `hyperv_host:{uuid}`

### VM
- **Primary ID**: GUID da VM (`Msvm_ComputerSystem.Name`)
- **Source ID**: `{vm_guid}`

### Disco Virtual
- **Primary ID**: SHA256 do path normalizado
- **Formato**: `hyperv_disk:{hash_prefix}`

## Quality Handling

| Cenário | Quality |
|---------|---------|
| Métrica disponível | `good` |
| Métrica não suportada | `unsupported` |
| Valor estimado | `estimated` |
| Erro de coleta | `partial` |

**Importante**: Nunca enviar `0` para valor ausente. Sempre usar `quality: unsupported`.

## Métricas Coletadas

### Host
| Metric Key | Tipo | Unit |
|------------|------|------|
| `hyperv.vm.count` | long | count |
| `hyperv.host.memory.total` | long | bytes |
| `hyperv.host.cpu.count` | long | count |

### VM
| Metric Key | Tipo | Unit |
|------------|------|------|
| `hyperv.vm.state` | string | - |
| `hyperv.vm.cpu.usage` | double | percent |
| `hyperv.vm.memory.assigned` | long | bytes |
| `hyperv.vm.memory.usage` | double | percent |
| `hyperv.vm.uptime` | long | seconds |
| `hyperv.vm.network.throughput` | double | bytes_per_second |
| `hyperv.vm.disk.throughput` | double | bytes_per_second |

## Configuração

O coletor Hyper-V é automaticamente registrado quando:
1. O Agent está rodando no Windows
2. O namespace WMI `root\virtualization\v2` está acessível

### Verificação de Disponibilidade

```csharp
// Exemplo de verificação
var collector = serviceProvider.GetRequiredService<IHyperVCollector>();
var isAvailable = await collector.IsAvailableAsync(ct);
```

## Erros Comuns

| Erro | Código | Causa |
|------|--------|-------|
| Access Denied | `HYPERV_ACCESS_DENIED` | Sem permissão de admin |
| Unavailable | `HYPERV_UNAVAILABLE` | Hyper-V não instalado |
| WMI Error | `HYPERV_COLLECTION_ERROR` | Falha no WMI |

## Dependências

- `System.Management` (já incluso no Agent Windows)
- Windows Server 2012+ ou Windows 10/11 Pro
- Hyper-V role habilitada
- Permissões de Administrador

## Melhorias Futuras

- [ ] Suporte a Hyper-V Performance Counters (PDH)
- [ ] Coleta de métricas de replication
- [ ] Monitoramento de checkpoints/snapshots
- [ ] Suporte a Live Migration
