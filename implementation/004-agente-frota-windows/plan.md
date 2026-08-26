# Plano

## Estratégia

Separar transporte, agendamento e persistência em serviços testáveis; completar primeiro auth/outbox/heartbeat, depois configuração/comandos e finalmente instalador/empacotamento/frota.

## Arquivos previstos

- `AgentWorker.cs`, `EnrollmentService.cs`, `HeartbeatService.cs`, `ConfigurationService.cs`
- `Outbox/SqliteOutbox.cs` e migration SQLite local
- Commands e endpoints correspondentes na Cloud API
- `install/install-agent.ps1`, uninstall, publish scripts e manifesto
- projetos de testes novos/específicos do agente.

## Sequência reversível

- Migration SQLite compatível com schema atual.
- Publicar pacote versionado sem substituir o anterior.
- Pilotar em uma máquina, depois 5%, 25%, 100% da frota.
- Preservar pacote anterior e dados para downgrade.

## Testes e validações

- Unitários de expiração/refresh, classificação HTTP, backoff e heartbeat.
- Integração API real para registro, refresh, batch, heartbeat e commands.
- VM Windows para install/upgrade/repair/uninstall/reboot.
- Falhas simuladas de rede e disco cheio.

## Rollback

- Parar serviço, reinstalar pacote anterior e preservar ProgramData/outbox.
- API aceita pelo menos duas versões durante a janela de rollout.

## Aprovações necessárias

- Aprovação de requisitos do instalador/frota.
- Aprovação antes de qualquer distribuição para endpoints de cliente.
