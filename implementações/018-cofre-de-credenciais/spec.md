---
id: "018"
title: "Cofre de credenciais"
status: blocked
priority: medium
risk: critical
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["010", "011", "017"]
requirements: [RF-070, RF-071, RF-072, RF-073, RF-074, RF-075, RF-076, RF-077, RF-078, RF-079]
---
# Especificação

## Objetivo e escopo

Entregar um cofre admin-only por empresa, com metadados mascarados, revelação/cópia por endpoint específico após MFA/step-up, envelope encryption, versionamento, soft delete/restore e auditoria sem segredo.

**Estado:** bloqueado até conclusão da 017 e aprovação do provedor de chaves, retenção de auditoria, recovery e threat model.

## Fora de escopo

- acesso por clientes;
- compartilhamento público, preenchimento automático, extensão de navegador;
- exportação/break-glass no MVP;
- guardar a chave mestra no banco ou no mesmo ciphertext.

## Requisitos e critérios

- **RF-070/071/072 / CA-070:** autorização granular; lista apenas metadata; reveal exige step-up.
- **RF-073/076/077 / CA-071:** auditoria completa sem valor, `no-store`, sem analytics/log, reveal curto e limpeza de UI.
- **RF-074/075 / CA-072:** envelope encryption com key ID/rotação, versões e recuperação controlada.
- **RF-078:** testes negativos multiempresa, usuário, ação, ID direto e versão.
- **RF-079:** exportação/break-glass desabilitados.

## Restrições e riscos

Feature de impacto crítico. Não pode ser implementada com chave mestra no banco ou antes de MFA/step-up. Backups, rotação e indisponibilidade do provedor de chaves precisam de runbook.
