---
id: "017"
title: "Identidade e autorização para operações sensíveis"
status: awaiting_approval
priority: high
risk: critical
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["010", "011"]
requirements: [RF-070, RF-072, RF-078, RF-079, RF-083]
---
# Especificação

## Objetivo e escopo

Criar a fundação de identidade necessária ao cofre: permissões granulares por empresa e ação, MFA para admins sensíveis, step-up/reautenticação recente, política de sessão e testes negativos. Inclui compatibilidade e rollout; não armazena segredos de clientes.

## Fora de escopo

- tabelas/endpoints/telas do cofre (018);
- acesso client a segredos;
- escolha automática de provedor MFA ou custos sem aprovação.

## Requisitos e critérios

- **RF-070:** política admin-only com ações `list/create/update/reveal/copy/delete/restore/administer` por empresa.
- **RF-072:** operações sensíveis exigem MFA e step-up recente vinculado à sessão/ação.
- **RF-078 / CA-070:** testes provam negação por ID direto, empresa, role e ação.
- **RF-079:** break-glass/exportação desabilitados por padrão e governados.
- **RF-083:** sessão reduz exposição a XSS/roubo e permite revogação/auditoria.

## Restrições e riscos

Alterações de autenticação podem derrubar sessões ou bloquear admins. Provedor MFA, canal de recuperação e duração do step-up são decisões obrigatórias antes de implementar.
