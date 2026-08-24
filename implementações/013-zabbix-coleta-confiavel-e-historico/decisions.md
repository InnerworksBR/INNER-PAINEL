# Decisões — 013

- **D-013-01 — Autenticação:** API token de menor privilégio é preferencial; sessão por usuário é fallback com logout garantido. Status: decidido.
- **D-013-02 — Coordenação:** lease no PostgreSQL conforme ADR-002; sem broker obrigatório. Status: proposto.
- **D-013-03 — Saúde:** valor stale ou item ausente nunca é convertido em Online/Atenção. Status: decidido.
- **D-013-04 — Retenção:** política configurável com bruto e agregados; números aguardam medição de volume/SLO. Status: pendente.
- **D-013-05 — Polling:** uma coleta central por empresa alimenta todos os usuários; páginas não disparam coleta externa. Status: proposto.
