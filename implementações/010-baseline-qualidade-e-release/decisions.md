# Decisões — 010

- **D-010-01 — CI agnóstico:** scripts de qualidade ficam nos package files/scripts; o workflow apenas os orquestra. Status: decidido.
- **D-010-02 — Migration canônica:** `backend/` será a fonte de migrations; qualquer compatibilidade com arquivos da raiz será automatizada/documentada. Status: proposto, confirmar antes de remover duplicatas.
- **D-010-03 — Vulnerabilidades:** preferir upgrade compatível; major upgrade vira implementação própria se alterar contrato. Status: decidido.
- **D-010-04 — Gate de conclusão:** nenhum status “concluído” com teste falhando ou CA aberto. Status: decidido pelo PRD.

## Pendências

Confirmar o provedor de CI do repositório remoto antes de configurar regras de proteção; o workflow GitHub Actions é a suposição inicial por haver Git.
