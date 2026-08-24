# Plano

## Estratégia

Após gates, realizar security review do desenho; integrar KMS/secret provider aprovado por interface; criar modelo de metadata/ciphertext/DEK/version; implementar service sem logging; APIs autorizadas; UI com limpeza; auditoria; rotação; piloto restrito.

## Arquivos previstos

Migrations do vault/audit, crypto provider interface, vault service/routes, autorização, páginas admin, config/env, testes de segurança/integração/E2E e runbook.

## Dados e contratos

Registro guarda empresa, nome/tipo/tags, versão, ciphertext, encrypted DEK, key ID, timestamps e lifecycle; nunca plaintext. `GET list` não devolve ciphertext. `POST reveal` exige prova de step-up e responde `Cache-Control: no-store`; auditoria guarda ação/fingerprint, não conteúdo.

## Sequência reversível

Provider em homologação; migration; service offline; testes; metadata UI; criação sem reveal geral; piloto com poucos admins; rotação testada; ativação. Rollback bloqueia endpoints e preserva ciphertext recuperável.

## Testes e validações

Known-answer/roundtrip sem log, indisponibilidade KMS, rotação, versões, soft delete, concorrência, matriz multiempresa/ação, cache/analytics, clipboard/UI timeout, backup/restore e security review independente.

## Aprovações necessárias

Conclusão da 017; provedor/custo/chaves; migrations; retenção de auditoria; política de backup/recovery; piloto e produção.
