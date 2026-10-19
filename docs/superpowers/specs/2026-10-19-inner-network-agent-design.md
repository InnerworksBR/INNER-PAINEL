# Agente Inner de Rede — proposta de integração SNMP

Data: 2026-10-19  
Status: aprovado pelo usuário em 2026-10-19; implementação autorizada com GPT-6 Luna.

## 1. Resultado esperado

Instalar um coletor Windows em uma máquina da rede do cliente, receber um código e vincular esse código à empresa no Portal Inner. O coletor passa a descobrir e monitorar os equipamentos acessíveis por SNMP, sem instalar software em cada switch, roteador, firewall, access point ou impressora.

Confirmado em conversa:

- O protocolo é SNMP.
- A experiência desejada é instalar → receber código → vincular à conta.
- As credenciais SNMP serão cadastradas no painel, por empresa/rede.

Premissas propostas: Windows x64, serviço iniciado automaticamente, uma instalação por rede alcançável e configuração central. O pacote deve incluir o runtime necessário e a URL pública da API, dispensando edição de JSON e instalação manual de .NET.

SNMP precisa estar habilitado nos equipamentos, com acesso permitido a partir do coletor e credenciais de leitura válidas. Uma instalação só alcança outras VLANs e filiais se houver conectividade e autorização configuradas. Equipamentos sem SNMP não terão inventário ou métricas SNMP fabricados.

## 2. Evidências no repositório

- `agent/Inner.Agent.Windows/` contém o serviço Hyper-V, identidade da máquina, DPAPI, transporte HTTPS e outbox SQLite.
- `agent/install-agent.ps1` exige atualmente um arquivo de token emitido antes da instalação. O fluxo de código após instalar precisa ser implementado.
- `backend/src/routes/agent-routes.ts` fornece enrollment, refresh, métricas e heartbeat de Hyper-V.
- `backend/src/routes/admin/monitoring-routes.ts` fornece emissão administrativa de token por empresa.
- `backend/src/routes/client/network-routes.ts` e `web/src/pages/paginasClient/Rede/rede.jsx` já fornecem inventário, estatísticas, eventos e histórico de rede.
- `backend/migration_010.sql` e `migration_011.sql` já preveem agentes, coletores e campos SNMP; a existência dessas estruturas não comprova coleta real.
- O contrato de métricas e a outbox atuais são específicos de host e VMs. Seu comportamento pode ser compartilhado, mas lotes de rede exigem contrato próprio.
- O serviço criptográfico atual admite um fallback fixo de chave. Credenciais SNMP novas devem exigir chave de integração explicitamente configurada.
- Há arquivos antigos de `monitoring/` removidos na árvore de trabalho. Esta proposta usa Fastify e Supabase atuais e não depende de restaurar essa plataforma.

## 3. Abordagens consideradas

| Abordagem | Benefício | Custo ou restrição |
| --- | --- | --- |
| Coletor de rede próprio, com componentes comuns ao agente Hyper-V | Instalação em qualquer Windows com acesso à rede; ciclos e falhas independentes | Novo pacote e serviço, com pequeno núcleo compartilhado |
| Acrescentar SNMP diretamente ao serviço Hyper-V | Um processo em ambientes que já têm Hyper-V | Acopla o monitoramento da rede ao host e exige reconfigurar o agente instalado |
| Descoberta a partir do servidor do painel | Nenhum serviço local | Exige VPN ou acesso remoto às redes privadas dos clientes |

Recomendação: coletor de rede próprio. Compartilhar somente identidade, proteção local, credenciais da API e mecanismos de fila/transporte que sejam realmente comuns. Preservar os contratos e o funcionamento do Hyper-V durante essa extração.

## 4. Experiência de instalação e vinculação

1. O administrador baixa o pacote Agente Inner de Rede e executa o instalador como administrador na máquina escolhida.
2. O instalador cria o serviço `InnerNetworkAgent`, protege seus arquivos e dados e inicia a solicitação de vinculação pela API pública configurada no pacote.
3. A tela de instalação apresenta um código no formato `XXXX-XXXX-XXXX`, a validade e o endereço do painel. O código pode ser consultado novamente por um comando local de status.
4. No painel, o administrador abre Empresa → Integrações → Agente de Rede, informa o código e confere o nome da máquina que será vinculada.
5. O backend associa a instalação à empresa selecionada e registra a ação em auditoria. O serviço recebe suas credenciais próprias pela sessão privada de vinculação.
6. O painel apresenta as redes locais detectadas. O administrador mantém ou ajusta as redes e associa as credenciais SNMP cadastradas. Essas configurações ficam salvas para reinstalações e alterações posteriores que preservem a identidade do coletor.
7. Após salvar a primeira configuração válida, a descoberta inicial inicia automaticamente. O painel mostra andamento, equipamentos encontrados e falhas de consulta.

Se as credenciais já estiverem cadastradas para aquela rede, basta associá-las durante a vinculação. A configuração inicial não deve exigir cadastrar cada IP ou equipamento individualmente.

Sem internet, o serviço permanece instalado e informa que aguarda conexão para emitir o código. Se o código expirar, o serviço pode gerar outro sem reinstalar. Reexecutar o instalador em uma instalação vinculada preserva vínculo, configuração e fila.

## 5. Vinculação segura e recuperável

- A API cria uma sessão com um código humano aleatório e um segredo de dispositivo de alta entropia. O segredo fica somente no serviço, protegido por DPAPI e ACL.
- A sessão expira em 15 minutos. O serviço consulta seu estado a cada 5 segundos, respeitando o intervalo retornado pela API e eventual limitação de requisições.
- Código e segredo são armazenados por hash no backend; o código fica disponível localmente apenas pelo tempo necessário para sua apresentação.
- Criar sessões, testar códigos e consultar sessões têm limites por origem e por sessão, retornando `429` e `Retry-After` quando necessário. O código humano sozinho nunca permite obter tokens do agente.
- Somente um administrador autenticado pode vincular uma sessão à empresa. A empresa é resolvida no servidor; ela não é escolhida pelo agente anônimo.
- Vinculação concorrente a duas empresas é resolvida em uma transação: somente uma vence. Repetir a mesma confirmação não cria outro coletor.
- O serviço gera e persiste seu primeiro refresh token antes de concluir a sessão; envia seu hash autenticado pelo segredo de dispositivo. Isso permite repetir a conclusão se a resposta se perder, sem perder a credencial nem gerar outra instalação.
- A repetição da conclusão exige a mesma sessão, segredo e hash. A recuperação fica disponível por até 15 minutos após a conclusão; depois, usa-se o refresh já salvo ou uma nova vinculação administrativa.
- Access tokens têm validade curta e refresh tokens são rotacionados. Um coletor revogado deixa de receber configuração e de ingerir métricas mesmo com access token ainda válido.
- Uma instalação já vinculada não muda de empresa automaticamente. Transferência exige revogação e nova vinculação, sem transportar fila ou credenciais entre empresas.

## 6. Arquitetura e configuração

Fluxo: equipamentos → SNMP na rede local → serviço Windows → HTTPS de saída → Fastify → Supabase → painel.

O serviço mantém componentes separados para vinculação, leitura de configuração, descoberta, polling, persistência de inventário local, fila, envio e heartbeat. Coleta e envio têm ciclos independentes: falhas da internet não suspendem a coleta após o primeiro provisionamento.

Configuração por coletor:

- Empresa e escopo de rede, derivados do vínculo.
- Redes IPv4 em CIDR, exclusões e porta SNMP, inicialmente 161.
- Credenciais associadas às redes e suas versões.
- Intervalo de polling de 60 segundos e redescoberta de 15 minutos.
- Até 16 consultas simultâneas, timeout de 2 segundos e uma repetição por consulta.
- Até 4 credenciais por rede, com preferência pela última credencial válida de cada equipamento.
- Máximo de 4.096 endereços distintos por configuração, removendo sobreposições antes da varredura.

As redes das interfaces locais são sugestões para a configuração inicial. A coleta só usa redes salvas e habilitadas no painel. Uma rede excessiva exige reduzir o escopo; o serviço não amplia nem trunca silenciosamente o CIDR. Excluir multicast, broadcast, loopback e endereços de metadados/link-local. IPv6 fica fora desta primeira versão.

Não exigir resposta ICMP antes de consultar SNMP. Equipamentos podem responder a SNMP mesmo com ping bloqueado. Cada etapa respeita cancelamento, orçamento de tempo e limites de linhas nas tabelas consultadas.

A configuração é versionada, buscada ao iniciar e a cada 60 segundos. Uma alteração válida é persistida localmente antes de substituir a anterior; configuração inválida preserva a última válida e aparece no diagnóstico. Desabilitar uma rede impede novas consultas após o próximo refresh de configuração.

## 7. Credenciais SNMP

Primeira versão: SNMP v2c e SNMP v3 USM com `authNoPriv` ou `authPriv`, autenticação SHA-1 ou SHA-256 e privacidade AES-128 quando solicitada. A integração da biblioteca deve validar essas combinações contra um simulador; o painel só oferece combinações efetivamente implementadas.

Campos do cadastro: nome, versão, comunidade para v2c ou usuário, protocolo e segredo de autenticação, protocolo e segredo de privacidade para v3, além de contexto opcional. Não tentar comunidades padrão ou credenciais não cadastradas.

- Backend: AES-256-GCM com chave de integração explicitamente configurada e identificador de versão da chave. Se faltar chave, recusar cadastro/entrega de segredos com erro de configuração, sem usar segredo fixo.
- Painel: credenciais existentes aparecem mascaradas e podem ser substituídas; endpoints administrativos de leitura devolvem apenas metadados.
- Coletor: somente credenciais atribuídas ao seu escopo são entregues por endpoint autenticado, via HTTPS; cache local protegido por DPAPI e ACL de SYSTEM/Administradores.
- Logs, auditoria, snapshots e outbox não contêm comunidades, senhas ou tokens.
- Ao remover uma credencial da configuração, o coletor elimina seu cache após aplicar a nova versão. Offline, usa a última configuração válida; a remoção remota só passa a valer localmente após a reconexão.
- Campos legados `snmp_community` e `community_string` não recebem segredos novos nem são devolvidos nas rotas de dispositivos. Credenciais antigas exigem recadastro pelo fluxo seguro.

## 8. Inventário e métricas

Coleta comum a qualquer equipamento compatível:

- Nome SNMP, IP, descrição do sistema, `sysObjectID`, localização e contato quando fornecidos.
- Uptime SNMP em segundos, horário da consulta e duração da consulta SNMP.
- Interfaces: índice, nome/descrição, tipo, MAC, estado administrativo e operacional, velocidade e contadores de entrada/saída, erros e descartes.
- Taxas de tráfego calculadas entre amostras; usar contadores de 64 bits quando disponíveis. Reinício, reset ou troca de interface invalidam o delta, sem produzir taxas negativas ou picos artificiais.
- Fabricante, modelo, serial e versão de firmware quando expostos por MIB padrão; dados ausentes permanecem nulos.

CPU, memória e métricas específicas de fabricante ficam para perfis futuros. Classificação automática usa evidências disponíveis e mantém `Outro` quando não houver informação suficiente. Descrição, função e visibilidade editadas no inventário pelo administrador são preservadas.

`snmp_uptime` representa tempo desde a inicialização do subsistema SNMP, conforme o equipamento. Não converter esse valor em disponibilidade percentual. O campo legado `uptime_percent` será nulo sem cobertura suficiente e, quando calculado, representará sucesso das consultas SNMP na janela observada de 24 horas, com cobertura explícita. Queda do coletor não entra como falha do equipamento.

## 9. Identidade e persistência

Migrations serão aditivas, exceto substituição documentada de constraints que impedem coexistência ou identidade correta.

- `registered_agents`: acrescentar tipo/capacidade de agente. A unicidade passa a considerar empresa, máquina e tipo, permitindo Hyper-V e coletor de rede na mesma máquina.
- Nova tabela de sessões de vinculação: hashes, identidade da instalação, expiração, estado, empresa após confirmação e trilha administrativa. Nenhum agente com empresa fictícia é criado antes da vinculação.
- `snmp_collectors`: relacionar ao agente registrado e ao escopo de rede; manter configuração e diagnósticos, sem segredos em colunas legadas.
- Novas tabelas de redes e credenciais cifradas, com associação explícita entre rede, coletor e credencial.
- `network_devices`: estado atual, identificador estável, coletor, escopo, última tentativa, último sucesso e campos SNMP. `monitoring_source = 'agent_snmp'` identifica a nova origem.
- Tabelas próprias de lotes de rede, interfaces e amostras históricas. Índices por empresa/ativo/tempo e unicidade de sequência por agente garantem ingestão idempotente.
- `asset_profiles`: criar ou atualizar o perfil de cada equipamento mantendo campos manuais, visibilidade e participação na saúde.
- `network_status_history` e `monitoring_events`: registrar histórico e transições usando ID de dispositivo; consultas novas não dependem somente de nome.

O escopo de rede distingue filiais que usam os mesmos IPs privados. Dentro dele, o coletor conserva um UUID local por equipamento e seus identificadores observados. Serial/modelo, engine ID e MAC de chassis confiáveis podem confirmar identidade; IP é fallback. Nome e IP não são identidade global.

Troca de IP com identificador confiável mantém o ativo. Identificadores ambíguos geram diagnóstico e não fundem automaticamente dois equipamentos. Sem identificador estável, uma troca de IP pode exigir reconciliação administrativa. Dois coletores no mesmo escopo e com identidade confiável reutilizam o ativo; uma observação antiga não substitui estado mais recente.

A constraint legada `(company_id, device_name)` deve ser substituída para permitir nomes iguais em redes distintas. Ativos legados só são associados mediante correspondência inequívoca de empresa, escopo e IP ou identificador. Casos ambíguos permanecem separados para revisão.

Ingestão transacional grava lote, histórico e estado; a mesma sequência retorna o mesmo ACK. Lotes antigos acrescentam histórico sem regredir estado atual. Falha parcial na consulta de um equipamento não apaga interfaces nem outros equipamentos.

## 10. Rotas propostas

| Público | Método e rota | Comportamento |
| --- | --- | --- |
| Instalador/serviço | `POST /api/agent/v1/pairings` | Cria sessão limitada e retorna código, segredo privado, validade e intervalo |
| Serviço | `POST /api/agent/v1/pairings/status` | Consulta autenticada pelo segredo; não expõe sessão pelo código humano |
| Administrador | `POST /api/admin/monitoring/companies/:companyId/network-agents/claim` | Confirma código e empresa com auditoria |
| Serviço | `POST /api/agent/v1/pairings/complete` | Conclui vínculo de modo repetível com hash do refresh persistido |
| Serviço vinculado | `GET /api/agent/v1/network/config` | Entrega versão, redes e apenas as credenciais autorizadas |
| Serviço vinculado | `POST /api/agent/v1/network/metrics` | Valida lote próprio de rede, sequência e chave de idempotência |
| Serviço vinculado | `POST /api/agent/v1/heartbeat` | Atualiza saúde e andamento sem depender de métricas de host |
| Administrador | Rotas sob `/api/admin/monitoring/companies/:companyId/network-agents` | Lista, configura, pausa e revoga coletores |
| Administrador | Rotas sob `/api/admin/monitoring/companies/:companyId/snmp-credentials` | Cria, substitui e remove credenciais; leitura retorna metadados |
| Cliente | Rotas existentes em `/api/client/network` | Lista, estatísticas, eventos, detalhes, interfaces e histórico autorizados |

O contrato Hyper-V existente continua aceito. As novas rotas de rede verificam o tipo de agente no servidor. Nunca confiar em `company_id`, escopo ou coletor enviados no payload como autorização.

## 11. Falhas, fila e estados

Cada lote é salvo em SQLite antes do envio. ACK confirma a remoção; falhas temporárias usam backoff com jitter, `429` respeita `Retry-After`, `401` tenta renovar e erros permanentes vão para quarentena. A fila tem limite inicial de 100 MB ou 1.000 lotes; atingir o limite gera diagnóstico explícito de perda de cobertura, sem descarte silencioso.

O inventário e contadores necessários para polling sobrevivem ao reinício. O envio de backlog não impede novas coletas. Cada equipamento tem seu horário real de observação, inclusive em ciclos longos ou parciais.

Estados são separados:

- Coletor: aguardando vínculo, aguardando configuração, descobrindo, online, atrasado, offline, pausado ou revogado.
- Consulta: sucesso, parcial, timeout, autenticação negada quando o protocolo permite identificar, erro de protocolo ou OID não suportado. Timeout v2c não comprova credencial errada nem queda física.
- Equipamento: online após consulta válida; atenção após uma falha; sem resposta SNMP após três tentativas de polling consecutivas sem resposta. Isso não afirma indisponibilidade total da rede.
- Sem observações recentes: atrasado após 3 minutos e sem dados após 10 minutos. Coletor offline produz estado sem dados, preservando o último resultado conhecido do equipamento.

O backend aplica freshness em todas as superfícies que leem rede: lista, detalhe, estatísticas, dashboard e NOC. O NOC diferencia equipamento sem resposta de ausência de telemetria do coletor e respeita as configurações de participação na saúde.

## 12. Painel

Empresa → Integrações recebe a seção Agente de Rede com download, vinculação por código, máquina, versão, status, último contato e quantidade de equipamentos. Configuração de redes e credenciais fica no mesmo contexto de empresa, com campos e mensagens em português.

A tela Rede usa os ativos existentes, acrescenta última consulta, estado de telemetria e detalhes das interfaces. Estados de lista vazia distinguem sem coletor, aguardando configuração, descoberta em andamento e nenhum equipamento respondendo.

Atualização inicial por leitura completa e polling de 30 segundos, mantendo o padrão de autenticação e seleção de empresa do portal. O botão Atualizar recarrega os dados recebidos; não deve sugerir descoberta instantânea caso nenhum comando remoto tenha sido implementado.

## 13. Verificação e aceite

Antes de considerar a integração concluída:

1. Instalação em Windows sem Hyper-V emite código, vincula à empresa e aparece no painel sem editar arquivos.
2. Código expirado, usado, inválido e duas confirmações concorrentes não criam vínculo indevido; perda de resposta e reinício durante a vinculação permitem recuperação.
3. Hyper-V e coletor de rede coexistem na mesma máquina e os testes existentes do Hyper-V continuam passando.
4. Simulador real de SNMP verifica v2c e v3, tabelas de interfaces, credencial inválida, timeout, OID ausente, cancelamento e contador reiniciado.
5. Equipamento com ping bloqueado e SNMP válido é descoberto; redes inválidas, excessivas ou sobrepostas respeitam o orçamento.
6. Mesmo IP em filiais distintas, mesmo nome, mudança de IP, duas fontes e identificadores ambíguos não misturam ativos ou empresas.
7. Ingestão duplicada ou antiga não duplica histórico nem regride estado; transação interrompida pode ser repetida com segurança.
8. Uma hora sem internet mantém coleta dentro do orçamento da fila; reconexão envia backlog e reinício preserva credenciais e inventário.
9. Segredos não aparecem nas respostas administrativas de leitura, rotas do cliente, logs, auditoria ou lotes. Um agente não lê credenciais nem envia dados por outro escopo.
10. Painel, dashboard e NOC distinguem perda de resposta SNMP de perda do coletor, com dados reais nos testes de integração.
11. Build do backend e frontend, testes relevantes e publicação do pacote Windows passam. Instalação em laboratório e piloto em equipamento real são registrados separadamente; simulador não comprova compatibilidade com todo fabricante.

Implantação no servidor e execução do instalador em máquinas do cliente são etapas operacionais posteriores. O desenvolvimento deve entregar migration revisável, pacote instalável, testes e instruções de piloto, com as verificações ainda não executadas explicitamente identificadas.

## 14. Limites da primeira entrega

Ficam para entregas futuras: Linux, IPv6, SNMP traps, topologia LLDP/CDP, backup de configuração, alterações nos equipamentos, métricas proprietárias, comandos remotos e atualização automática do agente.

A primeira entrega cobre descoberta e consulta SNMP dos equipamentos alcançáveis nas redes configuradas. Não promete acesso a toda a rede sem credenciais ou configuração dos próprios equipamentos.

## 15. Referências de protocolo

- Identificação e objetos de sistema: [RFC 3418](https://www.rfc-editor.org/rfc/rfc3418.html).
- Interfaces, contadores e discontinuidades: [RFC 2863](https://www.rfc-editor.org/rfc/rfc2863.html).
- Autenticação e segurança USM: [RFC 3414](https://www.rfc-editor.org/rfc/rfc3414.html).
- Autenticação SHA-256 no USM: [RFC 7860](https://www.rfc-editor.org/rfc/rfc7860.html).
- Privacidade AES-128: [RFC 3826](https://www.rfc-editor.org/rfc/rfc3826.html).

Os limites operacionais, intervalos e fluxo de vinculação acima são decisões propostas para o Portal Inner, não exigências dessas RFCs.
