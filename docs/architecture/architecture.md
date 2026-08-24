# Arquitetura-alvo — Portal Inner

**Status:** proposta técnica derivada do PRD aprovado  
**Data:** 2026-07-16  
**Fonte:** `docs/product/PRD.md`

## Contexto e requisitos aprovados

O portal continuará com o frontend React/Vite, a API Fastify/TypeScript e o PostgreSQL/Supabase existentes. A evolução prioriza confiabilidade do dado operacional, isolamento entre empresas, execução coordenada das integrações e rastreabilidade. Não será introduzido um broker ou novo serviço obrigatório nesta fase; coordenação e estado de jobs usarão o banco já existente.

## Componentes e limites

1. **Frontend operacional:** solicita conjuntos paginados e filtrados; nunca recalcula métricas com uma amostra parcial. Exibe período, origem, última atualização, carregamento, vazio, erro e desatualização.
2. **API de leitura:** resolve empresa no backend, valida filtros, pagina e devolve dados mais metadados do conjunto. Métricas e exportações reutilizam o mesmo filtro normalizado.
3. **Adaptadores de integração:** encapsulam GLPI, Zabbix e Microsoft 365, com timeouts, retries, sanitização de erros e mapeamentos versionados.
4. **Orquestrador de sincronização:** registra execução, obtém lease distribuído, impede sobreposição, aplica idempotência e atualiza freshness. Inicialmente roda no processo atual, mas sem depender de memória local para exclusão mútua.
5. **Camada de estado operacional:** persiste último estado válido, histórico bruto com retenção, agregados para tendências e status das integrações.
6. **Cockpit:** consome um read model por empresa com sinais normalizados; não consulta diretamente APIs externas durante a renderização.
7. **Inventário:** preserva identificador e campos da origem, publicação por empresa, overrides manuais separados e reconciliação de exclusões/transferências.
8. **Documentos:** mantém o contrato da implementação 009 e reutiliza storage, documentos e auditoria existentes.
9. **Identidade e cofre:** o cofre só avança após autorização granular, MFA/step-up e provedor de chaves aprovados.

## Contratos e integrações

### Envelope de listagem operacional

```json
{
  "data": [],
  "page": { "number": 1, "size": 50, "total": 0 },
  "filter": { "period": "30d" },
  "meta": {
    "source": "glpi",
    "last_success_at": "ISO-8601|null",
    "freshness": "fresh|stale|unavailable",
    "generated_at": "ISO-8601"
  }
}
```

- Períodos aceitos: `7d`, `30d`, `90d`, `custom` e `all`; ausência significa `30d`.
- `all` é sempre explícito. Intervalos customizados exigem início/fim válidos e limite de página.
- CSV usa o mesmo objeto de filtro da consulta e é produzido no servidor, com limites e streaming quando necessário.
- Erros externos são sanitizados e recebem `correlation_id`; a última leitura válida pode ser devolvida marcada como stale.

### Execução de integração

Cada execução registra `run_id`, empresa, integração, job, tentativa, início/fim, duração, estado, volume, último sucesso e erro sanitizado. O lease possui dono e expiração; uma execução só atualiza o estado se ainda possuir o lease. Retries usam backoff com jitter e não duplicam upserts.

### GLPI

- O adaptador identifica versão/capacidades e isola diferenças entre REST v1/v2.
- Chamados preservam campos brutos necessários para auditar criação, resolução, deadline e SLA TTR.
- O estado derivado é `complied`, `at_risk`, `violated` ou `no_sla`; percentual exclui `no_sla` e cobertura é exibida separadamente.
- Sync é incremental por cursor de modificação, com janela de sobreposição e reconciliação periódica.
- Inventário usa chaves compostas por empresa, tipo e ID da origem; software é relação de instalação, não texto agregado no ativo.

### Zabbix

- Preferência por API token de menor privilégio. Credencial de usuário é compatibilidade e sempre encerra sessão em `finally`.
- Coleta em lotes, com cliente HTTP reutilizado durante a execução, timeout e concorrência limitada.
- Valores acima do limite de idade não alimentam saúde atual.
- Retenção e agregações são políticas configuráveis; valores definitivos dependem de volume/SLO aprovados.
- Hosts removidos, desabilitados ou sem itens mínimos são reconciliados com estado explícito.

### Microsoft 365

- Licenças atribuídas, usuários habilitados e atividade são métricas distintas.
- A sincronização reconcilia SKUs ausentes e registra freshness/cobertura sem transformar ausência contratual em falha.

## Modelo de dados

As migrations previstas são aditivas e versionadas. Nenhuma é aplicada em produção por este documento.

- completar `glpi_tickets` com `glpi_date_mod`, campos brutos de SLA/deadline/resolução e versão do mapeamento;
- adicionar estado de execução/lease de integrações e índice por empresa/integracão/job;
- adicionar agregados de métricas e política de retenção sem remover histórico antes de validação;
- criar entidades de inventário da origem, instalações de software, publicação, overrides e conflitos;
- criar read model/alertas do cockpit com reconhecimento auditável;
- identidade/cofre ficam em migrations separadas e bloqueadas até ADR-003 aprovado.

Toda tabela multiempresa deve ter `company_id`, índices compatíveis com filtros e políticas/checagens de isolamento coerentes com o acesso pela API.

## Segurança

- Empresa é resolvida a partir da sessão/permissão no backend; `company_id` enviado pelo cliente nunca basta para autorizar.
- HTML de relatório é sanitizado ou servido em origem isolada; iframe recebe sandbox sem acesso ao origin.
- Uploads validam assinatura real, tamanho por arquivo e total, usam fluxo limitado e removem órfãos em falha.
- Login recebe rate limit e resposta neutra; produção falha ao iniciar com CORS wildcard e adota headers de segurança.
- Logs, métricas e auditoria não contêm tokens, senhas, segredo de cofre ou conteúdo confidencial.
- Cofre usa envelope encryption com chave mestra fora do banco, step-up/MFA, respostas `no-store`, versionamento, auditoria e testes negativos multiempresa.

## Testes

- unitários para normalização de filtros, SLA, freshness, criticidade e mapeamentos de integração;
- integração para migrations em banco vazio, paginação, leases, idempotência e isolamento multiempresa;
- contratos com fixtures aprovadas de GLPI/Zabbix e amostras reconciliadas com as fontes;
- E2E dos fluxos de Chamados, Cockpit, Inventário, Word e Cofre;
- performance para páginas operacionais e volume representativo;
- segurança para autenticação, upload, iframe e acesso direto a recursos de outra empresa.

## Deploy e rollback

1. migrations aditivas;
2. escrita dupla/backfill quando necessário;
3. leitura nova atrás de feature flag por empresa;
4. comparação de indicadores antigos/novos em homologação;
5. ativação progressiva e monitorada;
6. rollback por flag e código, preservando colunas/tabelas novas até estabilização.

Jobs novos começam desabilitados, executam dry-run/empresa piloto e só substituem o agendamento antigo após evidência de unicidade, volume e freshness.

## Riscos e ADRs

- divergência entre versões/configurações GLPI: mitigada por descoberta de capacidades e fixtures por versão;
- volume de histórico desconhecido: bloqueia números finais de retenção e exige medição antes de backfill;
- múltiplas réplicas: resolvido por lease persistente, não por mutex em memória;
- cockpit amplificar indicadores errados: depende da convergência de GLPI/Zabbix e health model;
- cofre ampliar impacto de uma sessão comprometida: bloqueado até ADR-003, MFA e step-up;
- template Word ausente: mantém a implementação 009 bloqueada sem impedir as demais.

Decisões detalhadas: ADR-001 a ADR-003 em `docs/architecture/decisions/`.
