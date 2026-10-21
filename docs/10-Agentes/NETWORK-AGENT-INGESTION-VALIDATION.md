# Inner Network Agent 1.1.1 — transporte e identificadores SNMP

Data: 21/10/2026.

## Evidências do atendimento

No SRVHOST01, a consulta direta a `192.168.16.92:161` respondeu em SNMP v2c com a comunidade esperada. A consulta aos sete OIDs de identificação também recebeu resposta. O cache local confirmou configuração v13 ativa, rede `192.168.16.0/22`, credencial vinculada e equipamento sem exclusão. Os logs do serviço registraram `JsonException` após heartbeat e rejeição permanente dos lotes 73–75 pelo backend. A resposta de identificação foi `EPSON Built-in 11b/g/n Print Server`.

## Correções verificadas

- O endpoint de heartbeat retorna HTTP 204. Quando a resposta não declara `Content-Length`, o cliente tentava desserializar um corpo vazio. O cliente agora reconhece 204 explicitamente para respostas `JsonElement`. Um 204 continua insuficiente para confirmar um lote de métricas: o ACK exige `status` aceito e sequência correspondente.
- `ifPhysAddress` e `snmpEngineID` são OCTET STRINGs binárias. A conversão anterior por UTF-8 podia perder bytes e inserir NUL nos campos de texto. O cliente agora formata MAC em hexadecimal separado por dois-pontos e engineID em hexadecimal, tanto em GET quanto em WALK. As demais leituras mantêm seu tipo e comportamento.
- Serviço, projeto e instalador usam a versão 1.1.1 para permitir conferir o pacote realmente instalado.

## Validação

Três testes novos falharam antes da correção: heartbeat 204 sem comprimento, ACK vazio de métricas e probe real com MAC/engineID binários. Após a correção, a suíte passou com **68 testes, zero falhas e zero ignorados**. Os testes SNMP usam UDP em loopback e o probe real, incluindo SQLite e serialização do lote. Há um aviso preexistente de SHA-1 obsoleto no simulador usado para compatibilidade.

Um PostgreSQL 16 local, descartável e com rede `none`, reproduziu `22P05: unsupported Unicode escape sequence` ao receber JSONB com o MAC antigo contendo `\u0000`. Os identificadores normalizados foram aceitos. Esse teste comprova o defeito de conversão e sua consequência no JSONB; não identifica sozinho a causa exata dos lotes rejeitados na base de produção.

A revisão independente em GPT-6 Luna não encontrou bloqueios importantes. O build `agent/build-network-agent.ps1` terminou com saída zero. Instalador e serviço informam versão de arquivo `1.1.1.0`; o instalador do ZIP é idêntico ao executável avulso e o recurso de payload embutido foi comparado ao ZIP publicado pelo build. A configuração embutida usa a API HTTPS esperada e mantém o diretório de dados existente.

SHA-256 do instalador: `252E329F699AC892BE4E0DD74ED14AC2E6A1A8D9AE982F7661A7A8D59FE33427`.

SHA-256 do ZIP de distribuição: `53C7552E23E07CC1746B175A4949BC3C04E2CAB1072EDF43764E9A0624391BEA`.

## Atualização e verificação no cliente

Executar `InnerNetworkAgent-Setup-1.1.1.exe` como administrador no SRVHOST01, sobre a instalação existente. O instalador preserva identidade, configuração e arquivos locais. Conferir versão 1.1.1 no cartão do coletor e a entrada da impressora `192.168.16.92`/`IMP-ADM` na rede da empresa após a próxima coleta.

Ainda é necessária essa validação no SRVHOST01. Nenhum resultado local comprova aceitação dos lotes em produção. Lotes já rejeitados e removidos da outbox não são recuperados por esta correção; o agente gera novas observações dos alvos conhecidos. Os artefatos locais são ignorados pelo Git; enviar o código não substitui automaticamente o pacote servido no painel.
