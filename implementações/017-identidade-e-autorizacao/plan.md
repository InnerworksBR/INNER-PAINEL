# Plano

## Estratégia

Fazer threat model e decisão de provedor; modelar grants; adicionar autorização central deny-by-default; implementar enrolamento/recovery MFA e step-up; migrar sessão de forma compatível; aplicar primeiro a rotas de teste e depois preparar o contrato usado pela 018.

## Arquivos previstos

Migrations de roles/grants/MFA/session, auth hook/service/routes, auditoria, páginas Minha Conta/Admin, env/config e testes de segurança/E2E.

## Dados e contratos

Permissão é tupla usuário/role, empresa ou escopo global e ação. Step-up retorna prova curta vinculada a sessão, usuário, propósito e expiração. Segredos MFA/recovery recebem proteção própria e nunca aparecem em logs.

## Sequência reversível

Schema aditivo; modo audit-only; concessões equivalentes às roles atuais; enrolamento de admins; enforcement por feature flag; rotas sensíveis; corte. Rollback volta enforcement sem apagar configuração MFA.

## Testes e validações

Matriz role/empresa/ação, sessão revogada, step-up expirado/replay, recovery, CSRF/XSS posture, brute force, acessibilidade e E2E com admin piloto.

## Aprovações necessárias

Provedor/custo MFA, política de recuperação, duração de sessão/step-up, migration e rollout em produção.
