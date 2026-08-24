# ADR-003: Pré-requisitos de identidade e chaves para o cofre

- Status: proposed — decisão de provedor pendente
- Data: 2026-07-16

## Contexto

O portal ainda usa autorização ampla e sessão incompatível com a exposição de credenciais de clientes. Armazenar apenas ciphertext no banco não resolve sessão comprometida, rotação, segregação ou auditoria.

## Decisão

Separar a entrega em duas implementações. Primeiro: permissões granulares por empresa/ação, MFA, step-up recente e política de sessão. Depois: cofre admin-only com envelope encryption, chave mestra fora do banco, key ID, versionamento, soft delete, `no-store` e auditoria sem segredo. O provedor de MFA/chaves e a política de break-glass precisam de aprovação explícita antes da implementação do cofre.

## Alternativas

- criptografar com chave em variável de ambiente única: rejeitada por rotação e blast radius inadequados;
- cofre antes de MFA/step-up: rejeitada por ampliar o impacto de sessão roubada;
- permitir clientes no MVP: rejeitada pelo PRD aprovado.

## Consequências

A implementação do cofre permanece bloqueada até decisões de provedor/custo e threat model. A fundação de identidade pode ser planejada, mas alterações de autenticação e produção exigem aprovação específica e rollout reversível.

## Evidências

RF-070 a RF-079, RF-083, RNF-001, RNF-002 e CA-070 a CA-072 do PRD aprovado.
