# ADR-002: Orquestração com lease persistente

- Status: proposed
- Data: 2026-07-16

## Contexto

Cron e polling em processo podem executar em duplicidade com múltiplas réplicas, sobrepor coletas e não deixam trilha operacional suficiente. Um broker externo aumentaria custo e operação antes de o volume ser conhecido.

## Decisão

Manter o disparo no backend atual, mas mover exclusão mútua e estado da execução para PostgreSQL/Supabase. Cada job obtém um lease atômico com expiração, registra `run_id` e só confirma resultado se ainda for dono. O desenho aceita substituição futura do disparador por worker/fila sem mudar adaptadores ou contratos.

## Alternativas

- mutex em memória: rejeitada por não coordenar réplicas;
- cron externo sem estado: rejeitada porque evita parte da duplicidade, mas não oferece lease, tentativas ou observabilidade;
- broker/worker dedicado agora: adiado até haver medição que justifique novo serviço e custo.

## Consequências

Exige migration aditiva, recuperação de leases expirados e testes com concorrência. Não autoriza alterar produção. Reduz duplicidade sem introduzir infraestrutura externa nesta etapa.

## Evidências

RF-017, RF-021, RF-022, RF-036, RF-087 e RNF-007 do PRD aprovado.
