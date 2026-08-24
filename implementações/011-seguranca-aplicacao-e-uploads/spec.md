---
id: "011"
title: "Segurança da aplicação e uploads"
status: awaiting_approval
priority: critical
risk: high
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["010"]
requirements: [RF-080, RF-081, RF-082, RF-083]
---
# Especificação

## Objetivo e escopo

Fechar os riscos imediatos encontrados no relatório HTML, uploads e autenticação: isolar conteúdo ativo de Segurança, limitar e validar uploads, eliminar órfãos, aplicar rate limit/respostas neutras, impedir CORS wildcard em produção e configurar headers/política de sessão compatíveis com a futura evolução de identidade.

## Fora de escopo

- MFA, step-up e RBAC granular (implementação 017);
- cofre de credenciais (018);
- pentest externo ou troca completa da autenticação.

## Requisitos e critérios

- **RF-080 / CA-080:** HTML não lê `parent`, cookies, storage ou token do portal.
- **RF-081 / CA-081:** arquivo inválido/grande é rejeitado sem órfão nem uso de memória não limitado.
- **RF-082:** login limitado por origem/identidade com resposta neutra; CORS de produção usa allowlist explícita.
- **RF-083:** headers de segurança, cache e sessão têm política documentada e testada.
- **RNF-001/002:** isolamento multiempresa e ausência de dados sensíveis em logs/erros.

## Restrições e riscos

Relatórios HTML existentes podem perder recursos que dependam de scripts. Mudanças de cookie/sessão que quebrem compatibilidade ficam fora deste pacote e serão feitas na 017 com rollout específico.
