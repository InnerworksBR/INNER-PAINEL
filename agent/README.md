# Inner Hyper-V Agent

Agente Windows instalado uma única vez no host físico Hyper-V. Ele coleta o host e descobre automaticamente as VMs do Hyper-V; não é necessário instalar um agente dentro de cada VM.

## Fluxo

1. No painel, abra a empresa e gere um token de ativação do Agente Inner.
2. Gere o pacote no ambiente de build:

   ~~~powershell
   .\build-agent.ps1
   ~~~

3. Salve o token baixado pelo painel em um arquivo protegido no host Hyper-V (não passe o segredo como argumento) e execute o PowerShell como Administrador:

   ~~~powershell
   .\install-agent.ps1 -ApiBaseUrl "https://painel.exemplo.com" -ActivationTokenFile "C:\Secure\inner-agent-token.json"
   ~~~

O instalador lê o token do arquivo, grava-o temporariamente em bootstrap.json, remove o arquivo de origem e o bootstrap depois do registro. O token é usado uma única vez no enrollment. O agente guarda access/refresh tokens usando DPAPI e os lotes pendentes em SQLite.

## Coleta

- host físico: CPU, memória, disco do sistema e uptime;
- VMs Hyper-V: ID, nome, estado, CPU, memória atribuída/demanda, uptime e tamanho dos discos quando disponível;
- intervalo padrão: 60 segundos;
- envio: HTTPS para /api/agent/v1;
- indisponibilidade da API: outbox local com retry ordenado e idempotência;
- painel: SSE autenticado com polling de fallback.

## Operação

O serviço instalado chama-se InnerHyperVAgent. Os dados locais ficam em C:\ProgramData\InnerWorks\InnerAgent. Para diagnosticar:

~~~powershell
Get-Service InnerHyperVAgent
Get-WinEvent -LogName Application | Where-Object ProviderName -Like "*Inner*"
~~~

O banco agent_metrics retém snapshots brutos por 30 dias. O Zabbix não é usado pelo fluxo operacional do agente Hyper-V; credenciais/campos antigos podem permanecer no banco somente para compatibilidade histórica.
