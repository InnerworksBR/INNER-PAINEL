# Decisões — 019

- **D-019-01 — Plataforma Agente:** PowerShell 5.1+ (nativo no Windows Server 2016+). Executável standalone (.exe via PS2EXE) opcional para futuro. Status: decidido.
- **D-019-02 — Hypervisor suporte:** Hyper-V (primário); VMware via API futura. Status: decidido (Hyper-V only MVP).
- **D-019-03 — Autenticação Agente:** Company token UUID + device fingerprinting. Status: proposto.
- **D-019-04 — Intervalo coleta:** 60s para métricas, 5min para heartbeat. Status: decidido.
- **D-019-05 — Coletor SNMP:** .exe Windows com serviço Windows ou task agendada. Status: proposto.
- **D-019-06 — Community strings:** Texto no banco (MVP), migrar para cofre após impl. 018. Status: decidido.
- **D-019-07 — Retenção:** 30 dias bruto, 90 dias agregado (agent_metrics). Status: decidido pelo Discovery.
- **D-019-08 — Device types SNMP:** Switch, Router, Access Point, Printer, Sensor (temp), Unknown. Status: decidido.
- **D-019-09 — Migração Zabbix:** Dados existentes arquivados, não migrados. Status: decidido.
- **D-019-10 — Escalabilidade coletor:** Max 254 IPs por range, paginação automática. Status: decidido.
