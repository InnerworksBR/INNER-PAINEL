# 📝 Decisões de Arquitetura (ADRs)

## Índice de ADRs

Documentação das decisões arquiteturais significativas do projeto.

---

## 📋 ADRs Registrados

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [[ADR-001-contrato-dados-operacionais|ADR-001]] | Contrato e Dados Operacionais | ✅ Aprovado | 2026-07 |
| [[ADR-002-orquestracao-jobs|ADR-002]] | Orquestração de Jobs | ✅ Aprovado | 2026-07 |
| [[ADR-003-identidade-e-chaves-do-cofre|ADR-003]] | Identidade e Chaves do Cofre | ✅ Aprovado | 2026-07 |

---

## ADR-001: Contrato e Dados Operacionais

### Contexto

Precisamos definir a estrutura de dados para representar a relação entre empresas, contratos e os dados operacionais (servidores, tickets, etc.).

### Decisão

```
Empresa (companies)
  └── Contrato (contracts)
        ├── Servidores
        ├── Chamados GLPI
        ├── Métricas MS365
        └── Documentos
```

**Alternativas consideradas:**
1. Dados diretamente na empresa ❌
2. Contratos sem vínculo com empresa ❌
3. Múltiplos contratos por empresa ✅ (escolhida)

### Consequências

**Positivas:**
- Suporte a múltiplos contratos por cliente
- Isolamento de dados por contrato
- Facilidade de encerramento de contrato

**Negativas:**
- Queries mais complexas com joins

---

## ADR-002: Orquestração de Jobs

### Contexto

Como orquestrar a sincronização de dados com sistemas externos (Zabbix, GLPI, MS365)?

### Decisão

Usar **node-cron** para scheduling no próprio backend, com jobs independentes por fonte de dados.

```typescript
// Jobs executam independentemente
cron.schedule('*/30 * * * * *', syncZabbix);  // 30s
cron.schedule('*/30 * * * *', syncGLPI);      // 30min
cron.schedule('0 */6 * * *', syncMS365);       // 6h
```

**Alternativas consideradas:**
1. Job server dedicado (BullMQ) ❌
2. External cron ❌
3. **node-cron no backend** ✅ (escolhida)

### Consequências

**Positivas:**
- Simplicidade operacional
- Zero infra adicional
- Logs centralizados

**Negativas:**
- Não escala horizontalmente
- Monitoramento mais complexo

---

## ADR-003: Identidade e Chaves do Cofre

### Contexto

Como armazenar e gerenciar credenciais de APIs externas (Zabbix, GLPI, MS365)?

### Decisão

**Camadas de segurança:**
1. **Criptografia AES-256-GCM** para credenciais
2. **Chave mestra** em variável de ambiente
3. **RLS** no banco para acesso
4. **Cofre dedicado** (HashiCorp Vault) no futuro

```typescript
// Criptografia de credenciais
const encrypted = cryptoService.encrypt(sensitiveData);
// Armazenar encrypted no banco
```

**Alternativas consideradas:**
1. Credenciais em texto plano ❌
2. Base64 (não é criptografia) ❌
3. Criptografia simétrica ✅ (escolhida)
4. Cofre dedicado (futuro) 📋

### Consequências

**Positivas:**
- Proteção de credenciais em caso de vazamento
- Compliance com LGPD
- Preparação para futuro cofre dedicado

**Negativas:**
- Overhead de descriptografia
- Complexidade operacional da chave

---

## 📝 Criando um Novo ADR

Para criar um novo ADR:

1. Criar arquivo: `docs/09-Decisões/ADR-XXX-titulo.md`
2. Formato:

```markdown
# ADR-XXX: Título

## Status
Proposto | Aprovado | Deprecado

## Contexto
Descrição do problema ou situação.

## Decisão
Descrição da soluçãochosen.

## Alternativas Consideradas
1. **Opção A** - descrição
2. **Opção B** - descrição

## Consequências
### Positivas
- ...

### Negativas
- ...

## Referências
- Link para discussão
- Link para spec
```

---

> **Última atualização:** 2026-08
