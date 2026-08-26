# Decisões

## D-001 — Um agente por máquina

**Status:** proposta para aprovação.  
Todas as máquinas exibidas exigem instalação local. Descoberta remota de hosts não substitui o agente.

## D-002 — Credencial persistida, token de ativação descartado

**Status:** proposta para aprovação.  
Após enrollment, somente access/refresh/source ID protegidos por DPAPI permanecem. O token de ativação é de uso único e removido.

## D-003 — Upgrade preserva ProgramData

**Status:** proposta para aprovação.  
Binário vive em Program Files; config, secrets, outbox e logs vivem em ProgramData e sobrevivem a upgrade/repair.

## D-004 — Retry com classificação

**Status:** proposta para aprovação.  
401 renova credencial, 429 respeita Retry-After, 5xx/rede usa backoff com jitter e 4xx permanente quarentena o batch.
