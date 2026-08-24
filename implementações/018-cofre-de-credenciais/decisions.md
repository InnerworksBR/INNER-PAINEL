# Decisões — 018

- **D-018-01 — Escopo:** admin-only; clientes não acessam o MVP. Status: decidido.
- **D-018-02 — Criptografia:** envelope encryption, DEK por registro/versão e chave mestra fora do banco. Status: decidido; provider pendente.
- **D-018-03 — Leitura:** metadata e reveal são contratos separados; reveal usa `no-store` e step-up. Status: decidido.
- **D-018-04 — Lifecycle:** versionamento e soft delete; purge não faz parte do MVP até retenção ser aprovada. Status: proposto.
- **D-018-05 — Export/break-glass:** desabilitados. Status: decidido.

## Bloqueadores

Conclusão da 017; provedor de chaves/MFA; política de recovery, backup e retenção; aprovações de migration e produção.
