# Tarefas — Segurança da aplicação e uploads

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Criar testes negativos para HTML ativo e iframe | RF-080 / CA-080 | CT-011-01 hostile report | backend/web security tests | 010 | high |
| T-002 | Definir renderização sanitizada ou sandbox de origem opaca | RF-080 | CT-011-02 compatibilidade | security routes/page | T-001 | high |
| T-003 | Aplicar CSP, sandbox e bloqueio de navegação/download indevido | RF-080 / CA-080 | CT-011-03 storage/parent blocked | server/web | T-002 | high |
| T-004 | Inventariar upload endpoints e limites acumulados | RF-081 | CT-011-04 matriz de entrada | docs/tests | 010 | low |
| T-005 | Validar assinatura, extensão, MIME e tamanho total | RF-081 / CA-081 | CT-011-05 arquivos adversariais | upload routes/services | T-004 | high |
| T-006 | Implementar processamento limitado e limpeza compensatória | RF-081 / CA-081 | CT-011-06 falha parcial | storage/upload services | T-005 | high |
| T-007 | Aplicar rate limit e resposta neutra no login/reset | RF-082 | CT-011-07 brute force/enumeration | auth routes/server | 010 | high |
| T-008 | Tornar CORS de produção fail-closed e documentar allowlist | RF-082 | CT-011-08 preflight | server/env docs | 010 | medium |
| T-009 | Adicionar security headers e política de cache | RF-083 | CT-011-09 headers | server/tests | T-008 | medium |
| T-010 | Executar regressão auth, uploads, Segurança e isolamento | RNF-001/002 | CT-011-10 suite | tests/docs | T-003,T-006..T-009 | high |

Conclusão exige gates da 010 verdes e evidência de que nenhum payload sensível aparece em logs.
