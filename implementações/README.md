# Índice de Implementações — INNER PAINEL

Todas as implementações seguem a metodologia Spec-Driven Development.

| # | Nome | Status | Progresso | Prioridade |
|---|------|--------|-----------|------------|
| [001](./001-responsividade-web/) | Responsividade Web | 🟢 Concluída | 100% | Alta |
| [002](./002-controle-glpi-sla/) | Controle GLPI e SLA | 🟢 Concluída | 100% | Alta |
| [003](./003-login-recuperacao-senha/) | Login e Recuperação de Senha | 🟢 Concluída | 100% | Crítica |
| [004](./004-minha-conta-perfil-admin/) | Minha Conta e Perfil Admin | 🟢 Concluída | 100% | Alta |
| [005](./005-gestao-usuarios-ux-admin/) | Gestão de Usuários e UX Admin | 🟢 Concluída | 100% | Alta |
| [006](./006-correcoes-glpi-chamados/) | Correções e Melhorias GLPI/Chamados | 🟢 Concluída | 100% | Crítica |
| [007](./007-melhorias-zabbix-rede-docs/) | Melhorias Zabbix, Rede e Documentação | 🟢 Concluída | 100% | Alta |
| [008](./008-correcoes-telas-admin/) | Correções nas Telas Admin (Empresas, Inventário, Docs) | 🟢 Concluída | 100% | Alta |
| [009](./009-gerador-documentos-word/) | Gerador de Documentos Word | 🟡 Planejada | 0% | Alta |
| [010](./010-baseline-qualidade-e-release/) | Baseline de Qualidade e Release | 🟠 Aguardando aprovação | 0% | Crítica |
| [011](./011-seguranca-aplicacao-e-uploads/) | Segurança da Aplicação e Uploads | 🟠 Aguardando aprovação | 0% | Crítica |
| [012](./012-glpi-chamados-sla-e-periodos/) | GLPI — Chamados, SLA e Períodos | 🟠 Aguardando aprovação | 0% | Alta |
| [013](./013-zabbix-coleta-confiavel-e-historico/) | Zabbix — Coleta Confiável e Histórico | 🟠 Aguardando aprovação | 0% | Alta |
| [014](./014-cockpit-de-plantao/) | Cockpit de Plantão | 🟠 Aguardando aprovação | 0% | Alta |
| [015](./015-inventario-completo-glpi/) | Inventário Completo do GLPI | 🟠 Aguardando aprovação | 0% | Média |
| [016](./016-saude-e-integracoes/) | Saúde e Integrações | 🟠 Aguardando aprovação | 0% | Alta |
| [017](./017-identidade-e-autorizacao/) | Identidade e Autorização | 🟠 Aguardando aprovação | 0% | Alta |
| [018](./018-cofre-de-credenciais/) | Cofre de Credenciais | 🔴 Bloqueada por segurança | 0% | Média |

---

## Ordem de Execução Recomendada

### Roadmap aprovado em 2026-07-16

```text
010 Baseline e gates
 ├─► 011 Segurança imediata
 ├─► 012 GLPI chamados/SLA ─┐
 └─► 013 Zabbix confiável ─┼─► 016 Saúde/integrações ─► 014 Cockpit
                           └───────────────────────────► 015 Inventário GLPI

011 ─► 017 Identidade/MFA/step-up ─► 018 Cofre (bloqueado até decisões de chaves)

009 Gerador Word: independente, mas bloqueado pelo template oficial.
```

Recomendação de execução: iniciar por **010**; depois **011**, **012** e **013**. A **016** consolida semântica e telemetria antes do **014**. A **015** pode começar após contratos/migrations base. A **018** não deve ser iniciada antes da conclusão da **017** e das aprovações registradas no ADR-003.

### Ordem histórica do ciclo anterior

```
006 ─────────────────────────────────────────► executar PRIMEIRO (bug crítico CSV)
     (CSV export, filtros GLPI, UX chamados)

003 ─────────────────────────────────────────► executar logo após (bloqueio de usuários)
     (recuperação de senha, toggle login)

004 ─────────────────────────────────────────► pode ser em paralelo com 003
     (minha conta admin, edição de nome)

005 ─────────────────────────────────────────► independente
     (email em usuários, reset senha, UX admin)

007 ─────────────────────────────────────────► independente (pode ser paralelo com 005)
     (Zabbix mobile, gráfico, rede, docs)

008 ─────────────────────────────────────────► independente
     (admin: encoding/mojibake, feedback, empty states)
```

As orientações abaixo registram o ciclo 003–008 e não substituem o roadmap aprovado em 2026-07-16. Naquele ciclo, **006** deveria ser executada primeiro pelo bug crítico do CSV. As implementações 003–008 foram validadas contra o código disponível em 2026-06-19.

---

## Resumo do Review Completo (2026-06-19)

Review de todas as funcionalidades do portal, cobrindo autenticação, usuários, GLPI, Zabbix, Rede, MS365 e Documentação.

### Bugs Críticos
- **CSV de chamados completamente quebrado** (`chamados.jsx:125` — `\\n` literal em vez de newline real) → **impl. 006**
- Sem recuperação de senha → usuários bloqueados dependem de admin → **impl. 003**
- **Mojibake/encoding** no modal de Integrações (`empresasAdmin.jsx:407,417` — "sincronizaÃ§Ãµes", "Ãšltima") → **impl. 008**

### Importantes
- Admin não tem "Minha Conta" → não consegue trocar própria senha pela UI → **impl. 004**
- Tabela de usuários não exibe e-mail (e-mail está em `auth.users`, não em `profiles`) → **impl. 005**
- Busca de chamados não é reativa (requer clique em "Aplicar") → **impl. 006**
- Sidebar de servidores sumida em mobile (sem fallback selector) → **impl. 007**
- Eventos da tela Servidores não filtram pelo servidor ativo → **impl. 007**
- Rede sem busca, sem filtro de status, sem coluna de uptime → **impl. 007**
- Documentação usa `alert()` nativo para erro de download → **impl. 007**

### UX/Polimento
- Status "Atencao" sem acento no badge de servidores → **impl. 007**
- Gráfico de histórico mostra só HH:MM (ilegível para dados multi-dia) → **impl. 007**
- Contagens de categoria em documentação não refletem busca ativa → **impl. 007**
- Cards do dashboard admin não são clicáveis → **impl. 005**
- Sem botão "Limpar Filtros" em chamados → **impl. 006**
- Reset de senha admin sem campo de confirmação → **impl. 005**
- Mensagens de feedback não somem automaticamente → **impl. 005**
- MS365 sem empty state quando integração não configurada → **impl. 007**

---

## Mapa de Módulos

| Módulo | Implementação |
|--------|--------------|
| Login / Auth | 003 |
| Minha Conta (cliente + admin) | 004 |
| Gestão de Usuários Admin | 005 |
| Chamados GLPI | 006 |
| Servidores (Zabbix) | 007 |
| Rede | 007 |
| Microsoft 365 | 007 |
| Documentação | 007 |
| Dashboard Admin | 005 |
| Gestão de Empresas (admin) | 008 |
| Inventário (admin) | 008 |
| Documentos (admin) | 008 |
| Qualidade, CI e migrations | 010 |
| Segurança, relatórios HTML e uploads | 011 |
| Chamados e SLA confiável | 012 |
| Zabbix, freshness e histórico | 013 |
| Cockpit de plantão | 014 |
| Inventário completo GLPI | 015 |
| Saúde, MS365 e integrações | 016 |
| Identidade, MFA e step-up | 017 |
| Cofre de credenciais | 018 |

> **Não cobertos (já corretos):** `auditAdmin` (tem loading/erro/empty state), `configAdmin` (validação de timeout já planejada em 005 T-009), `dashboard.jsx` cliente (cards clicáveis, degrada com defaults). Login coberto por 003.
