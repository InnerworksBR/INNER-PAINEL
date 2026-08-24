---
id: "016"
title: "Saúde e integrações"
status: awaiting_approval
priority: high
risk: medium
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["010", "012", "013"]
requirements: [RF-004, RF-005, RF-036, RF-084, RF-085, RF-086, RF-087]
---
# Especificação

## Objetivo e escopo

Unificar o significado de “configurado”, “saudável”, “desatualizado” e “não aplicável” nas integrações e no dashboard. Corrige a detecção GLPI por `glpi_entity_id`, separa usuários/atividade/licenças do Microsoft 365, reconcilia SKUs e elimina polling duplicado por página/usuário.

## Fora de escopo

- compra/gestão de licenças Microsoft 365;
- alertas externos e automação de remediação;
- mudanças nas APIs externas.

## Requisitos e critérios

- **RF-004/005:** telas operacionais mostram estados completos, período, origem e freshness.
- **RF-036:** tentativa, sucesso, duração, volume e erro sanitizado por integração.
- **RF-084:** GLPI configurado usa o mesmo `glpi_entity_id` consumido pelo serviço.
- **RF-085:** licenças atribuídas não são chamadas de usuários ativos; SKUs ausentes são reconciliados.
- **RF-086:** health considera contrato, módulo, freshness, disco, rede, SLA e integração sem penalizar ausência esperada.
- **RF-087:** uma coleta central serve múltiplas páginas/usuários.

## Restrições e riscos

Atividade real no Microsoft 365 pode depender de permissões Graph adicionais. Sem permissão, a UI deve nomear a métrica disponível corretamente, não simulá-la.
