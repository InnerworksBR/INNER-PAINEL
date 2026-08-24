# Decisões — 011

- **D-011-01 — Conteúdo ativo:** relatório HTML não será executado com acesso ao origin do portal. Preferência por sanitização; fallback é iframe sandbox sem `allow-same-origin`. Status: proposto, validar fidelidade.
- **D-011-02 — Upload:** confiança será baseada em assinatura real e allowlist, não apenas no header do cliente. Status: decidido.
- **D-011-03 — Produção:** CORS sem allowlist impede startup em vez de aceitar `*`. Status: proposto.
- **D-011-04 — Sessão:** esta implementação documenta e endurece o que é compatível; a troca de mecanismo fica na 017. Status: decidido.
