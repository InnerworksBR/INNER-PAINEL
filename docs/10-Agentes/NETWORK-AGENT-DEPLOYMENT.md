# Inner Network Agent — implantação e piloto

O agente de rede é um serviço Windows independente do Hyper-V. A instalação apresenta um código; o administrador vincula esse código à empresa no painel e configura as redes e credenciais SNMP. O coletor consulta somente as redes habilitadas e envia os resultados pela API HTTPS.

Este guia separa a preparação do servidor da instalação no cliente. As migrations e o deploy descritos aqui são procedimentos de implantação; não são executados pelo instalador Windows.

## Preparação do backend

1. Fazer backup do banco e confirmar que as migrations existentes até `021_company_contacts.sql` foram aplicadas. Conferir o nome efetivo de `021` no ambiente antes de executar.
2. Aplicar, nesta ordem, `backend/migration_022_network_agent.sql`, `backend/migration_023_network_agent_retention_scopes.sql` e `backend/migration_024_network_agent_interop.sql` com a ferramenta administrativa de migrations do ambiente. As alterações adicionam as tabelas, funções e políticas do agente de rede, os vínculos por origem de coleta e os campos de inventário, mantendo a vinculação Hyper-V existente.
3. Configurar `SNMP_CREDENTIAL_ENCRYPTION_KEY` no serviço backend: exatamente 32 bytes, codificados em 64 caracteres hexadecimais ou Base64. Gerar o valor no gerenciador de segredos do ambiente. Há compatibilidade com `INTEGRATION_SECRET_KEY` explícita, mas a chave dedicada facilita a operação. Não usar JWT, senha de usuário ou chave fixa como substituto.
4. Guardar uma cópia segura da chave junto do procedimento de recuperação do banco. Uma troca direta da chave torna as credenciais salvas ilegíveis; este incremento não implementa recifragem automática.
5. Configurar `NETWORK_AGENT_VERIFICATION_URL` com a URL HTTPS completa da página de empresas do frontend publicado. A resposta padrão é o caminho relativo `/admin/empresas`; o operador deve definir a URL absoluta para permitir abertura a partir do Windows.
6. Publicar o backend e o frontend correspondentes. Manter as configurações atuais de autenticação, Supabase e HTTPS.

A chave cifra os segredos SNMP com AES-256-GCM. As leituras do painel devolvem apenas metadados; as credenciais completas são entregues somente ao coletor de rede autenticado e associado à configuração daquela empresa. No Windows, o cache e os tokens são protegidos por DPAPI e ACLs do diretório de dados.

## Gerar e disponibilizar o instalador

No repositório, usar o SDK .NET e PowerShell para gerar o pacote. O computador do cliente recebe o runtime incluído e não precisa instalar o SDK.

```powershell
.\agent\build-network-agent.ps1 -ApiBaseUrl 'https://innerworks-painelbackend.zvzr4n.easypanel.host'
```

O endereço acima é a base pública da API configurada neste checkout em 19/10/2026; confirmar o destino antes de distribuir um pacote para outro ambiente. O build deve usar HTTPS e a base sem duplicar o segmento `/api`.

Artefatos esperados em `agent/artifacts/`:

- `InnerNetworkAgent-Setup.exe`: instalador gráfico Windows x64 com o serviço e runtime embutidos.
- `Inner.Network.Agent-win-x64.zip`: distribuição usada pelo download autenticado no painel, contendo o instalador e instruções.

Para a imagem Docker do backend, copiar o ZIP para `backend/artifacts/Inner.Network.Agent-win-x64.zip` **antes** de construir a imagem. O contexto atual do Docker é `backend/`; o diretório irmão `agent/` não entra nesse contexto. Alternativamente, montar o arquivo em um caminho persistente do backend e configurar `NETWORK_AGENT_PACKAGE_PATH` com o caminho completo do ZIP. Não versionar os binários gerados.

A rota administrativa de download é `GET /api/admin/monitoring/network-agent/download`. Se o arquivo não estiver disponível, ela responde `503` com orientação de geração/publicação. Conferir o download com uma sessão administrativa válida depois do deploy.

## Instalar, vincular e configurar

1. No Windows x64 que alcança os equipamentos da empresa, abrir `InnerNetworkAgent-Setup.exe` e aceitar a elevação do Windows. O instalador cria ou atualiza o serviço `InnerNetworkAgent` e mostra o estado da instalação.
2. Copiar o código apresentado. Sem acesso à API, a instalação permanece aguardando conexão; o código é emitido quando o serviço consegue iniciar a sessão de vinculação. Cada sessão expira em 15 minutos.
3. No painel administrativo, abrir a empresa correta, acessar a integração de rede e vincular o código. Conferir o nome do computador antes de salvar a configuração.
4. Cadastrar uma credencial SNMP v2c ou v3 da empresa. Em v3, usar `authNoPriv` ou `authPriv`, SHA-1/SHA-256 e, quando houver privacidade, AES-128. A credencial deve corresponder à configuração do equipamento e à origem de rede do coletor.
5. Selecionar o coletor, cadastrar os CIDRs, exclusões de IP, porta SNMP e credenciais autorizadas por rede. Usar o endereço de rede no CIDR, por exemplo `192.168.10.0/24`, com quatro octetos decimais e sem zeros à esquerda. Habilitar a coleta e salvar. As redes detectadas pelo Windows são sugestões de contexto; não iniciam uma varredura por conta própria.
6. Acompanhar o último contato e os equipamentos na tela Rede. O intervalo padrão é 60 segundos para coleta e 15 minutos para redescoberta. Não há exigência de resposta a ping.

Um escopo físico é opcional. Usar o mesmo escopo explicitamente em dois coletores somente quando ambos observam a mesma rede física da mesma empresa. A reconciliação usa serial ou engine ID confiável; IP, CIDR e nome iguais não bastam. Redes de clientes diferentes nunca compartilham identidade.

Limites por configuração: 256 redes, 4.096 IPs distintos no total, até quatro credenciais por rede e 1.024 credenciais resolvidas. O coletor limita as consultas a 16 simultâneas e usa timeout de dois segundos com uma repetição. Os intervalos aceitos são de 30 a 3.600 segundos para coleta e de 60 a 86.400 segundos para descoberta; os padrões permanecem 60 e 900 segundos. A conectividade necessária é HTTPS de saída para a API e UDP de saída para as portas SNMP configuradas, normalmente 161. O serviço não exige porta de entrada da Internet.

## Diagnóstico e interpretação

- **Sem configuração/pausado:** verificar se há rede habilitada e credencial associada no coletor correto.
- **Aguardando conexão/código:** verificar DNS, relógio do Windows, TLS, acesso HTTPS à API e estado do serviço. Não desabilitar a validação de certificados.
- **Sem resposta SNMP:** verificar credencial, ACL de origem no equipamento, rota e UDP. Esse estado não comprova desligamento físico.
- **Dados atrasados/sem dados:** verificar último contato, fila de envio e conexão com a API. Telemetria fica atrasada aos três minutos e sem dados aos dez; observações antigas não tornam o equipamento atual novamente.
- **Disponibilidade desconhecida:** ausência de histórico não representa 0% nem 100%. Uptime SNMP é tempo desde o reinício do equipamento e não uma porcentagem de disponibilidade.
- **Novo vínculo necessário:** se o servidor rejeitar definitivamente o refresh de um agente já vinculado, o coletor interrompe as consultas em cache e registra `relink_required`. O próximo ciclo solicita um novo código; uma nova vinculação aprovada permite retomar. Erro de conexão ou resposta 503 preserva a coleta autorizada em cache.

O agente continua coletando com configuração em cache quando a API está indisponível. A fila local tem limite de 100 MB ou 1.000 lotes; uma interrupção que exceda essa capacidade pode causar descarte de dados antigos. Segredos SNMP não fazem parte dos lotes de telemetria.

Pausas, remoções de credenciais e alterações de redes chegam ao coletor na próxima atualização de configuração bem-sucedida. A revogação impede novas requisições autorizadas; um coletor sem conexão ainda pode usar o cache até conseguir consultar a API. Para interromper imediatamente a coleta local durante uma indisponibilidade, parar o serviço Windows.

Lotes rejeitados pela API com 400/413 saem da repetição e geram um diagnóstico limitado a 100 registros, com sequência, status e horário; o payload não fica nesse diagnóstico. O coletor continua enviando lotes posteriores e não marca o rejeitado como confirmado. Erros temporários, incluindo 429/5xx, permanecem sujeitos a nova tentativa.

Os lotes e amostras brutas do backend têm retenção de 30 dias. O scheduler remove dados expirados em lotes limitados por execução e registra backlog se o limite for atingido; o estado atual e o histórico de transições são preservados. Acompanhar esse log e o crescimento do banco no piloto.

## Piloto de aceitação

Executar em um Windows e equipamentos autorizados antes da distribuição geral:

1. Instalar, obter código, vincular à empresa e confirmar que outra empresa não lista o coletor ou suas credenciais.
2. Configurar um pequeno CIDR, um equipamento v2c e um v3. Confirmar inventário, interfaces e contadores; um OID opcional ausente deve aparecer sem valor, preservando o restante do inventário.
3. Interromper temporariamente o acesso à API, confirmar coleta local e restauração do envio sem duplicação quando a conexão retornar.
4. Reiniciar o equipamento e o serviço, verificando preservação do vínculo e das identidades e ausência de picos fabricados por reinício de contadores.
5. Alterar/remover uma credencial, pausar o coletor e revogar o vínculo. Conferir atualização da configuração e bloqueio das próximas requisições do agente revogado.
6. Instalar a mesma versão novamente e confirmar a preservação do diretório de dados e do vínculo existente.

Os testes de laboratório usam PostgreSQL isolado, HTTP simulado e SNMP UDP em loopback. Eles não substituem o piloto com o serviço instalado e equipamentos físicos. Os resultados de desenvolvimento ficam no plano `docs/superpowers/plans/2026-10-19-inner-network-agent.md`; o relatório técnico Windows está em [NETWORK-AGENT-WINDOWS-VALIDATION.md](NETWORK-AGENT-WINDOWS-VALIDATION.md).

Para repetir a validação SQL local, criar o container descartável abaixo, sem portas publicadas, rede externa ou volume persistente. O bootstrap em `backend/tests/network-agent-test-bootstrap.sql` representa apenas as dependências mínimas de teste; não deve ser aplicado ao banco da aplicação.

```powershell
docker run --name inner-network-agent-db-20261019 --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17-alpine
.\backend\tests\run-network-agent-pg-tests.ps1
```

O roteiro exige esse container isolado e cria um banco novo para aplicar as migrations 022–024, o fixture de integração e um teste de identidade com duas sessões concorrentes, com interrupção no primeiro erro. Se o container já existir, conferir sua origem e isolamento antes de reutilizá-lo. Ao terminar o laboratório, remover somente esse container descartável.

## Recuo operacional

Pausar ou revogar o coletor no painel e parar o serviço `InnerNetworkAgent` no Windows. Preservar o diretório de dados para diagnóstico conforme a política da empresa. Se for necessário voltar a versão da aplicação, manter as migrations aditivas e as tabelas de rede; não excluir dados para realizar o recuo. Recuperação do banco deve seguir o backup e o procedimento aprovado do ambiente. O serviço Hyper-V tem identidade própria e não depende do serviço de rede.
