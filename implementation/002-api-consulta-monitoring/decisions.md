# Decisões

## D-001 — Backend Fastify como BFF

**Status:** proposta para aprovação.  
O browser não acessará diretamente a Monitoring API. O backend autentica o usuário, resolve a empresa e usa um token de ponte curto.

## D-002 — Polling antes de SSE

**Status:** proposta para aprovação.  
O MVP usará polling de 30 segundos, já compatível com a UI. SSE será ativado somente após proxy/autorização e reconexão terem testes próprios.

## D-003 — Contrato específico de server overview

**Status:** proposta para aprovação.  
A lista receberá métricas compactas em uma única consulta; o modelo genérico de asset permanece para detalhe e futuras classes.

## D-004 — Tokens com finalidades separadas

**Status:** proposta para aprovação.  
Source e portal/service tokens terão validação por audience/scope e, idealmente, chaves distintas. Rotação será documentada e sem exposição no frontend.
