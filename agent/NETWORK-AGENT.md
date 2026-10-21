# Inner Network Agent para Windows

O agente é um serviço Windows x64 que inventaria equipamentos SNMP nas redes autorizadas no Portal Inner. A coleta só começa depois que o coletor estiver vinculado e receber configuração com redes habilitadas. As sub-redes detectadas pelo Windows são apenas contexto para o administrador; não iniciam consultas.

## Instalação

1. Extraia `Inner.Network.Agent-win-x64.zip` e abra `InnerNetworkAgent-Setup.exe` no Windows x64. Aceite a elevação solicitada pelo Windows.
2. Aguarde a instalação do serviço `InnerNetworkAgent`. Quando houver conexão com a API, a janela mostra o código emitido pelo serviço e o prazo de validade. Copie o código e conclua a vinculação no Portal Inner.
3. Se o Windows estiver sem conexão, o serviço instala e mantém a coleta aguardando configuração. Quando a API ficar acessível, o serviço solicita um código. Consulte o estado executando `network-agent-status.ps1` como administrador na pasta extraída.
4. No Portal, configure as redes e credenciais SNMP do coletor vinculado.

O instalador atualiza os arquivos do serviço sem remover o diretório de dados, identidade, configuração em cache ou outbox. O instalador não modifica o serviço Hyper-V. A instalação principal usa uma janela gráfica e não exige editar JSON nem instalar PowerShell ou .NET no computador cliente. `install-network-agent.ps1` é um atalho opcional para iniciar o mesmo instalador.

## Diagnóstico

Execute `network-agent-status.ps1` em um PowerShell elevado para ver o estado do serviço e, quando pendente, recuperar o código atual, validade e URL do Portal. O estado `waiting_for_internet` significa que a instalação foi concluída e o serviço tentará emitir o código quando recuperar HTTPS.

Arquivos locais ficam em `C:\Program Files\InnerWorks\NetworkAgent` e dados duráveis em `C:\ProgramData\InnerWorks\NetworkAgent`, protegidos por ACL de SYSTEM e Administradores. O serviço continua coletando com configuração em cache enquanto a API ou o token estão indisponíveis. O instalador configura início automático e conta LocalSystem.

Se uma instalação anterior falhou com acesso negado a `pairing-status.json`, use o instalador **1.0.1 ou posterior** como administrador. A versão 1.0.0 aplicava flags de herança de diretórios aos arquivos existentes e podia deixar suas permissões vazias. O instalador corrigido repara as permissões da pasta de dados, do banco e dos segredos, preservando os conteúdos e a vinculação. Não é necessário apagar o diretório de dados. Reexecutar o instalador 1.0.0 pode recriar o problema mesmo depois de um ajuste manual.

## Operação SNMP

Suporte a SNMP v2c e v3 (`authNoPriv`/`authPriv`), autenticação SHA-1/SHA-256 e privacidade AES-128. São consultadas somente redes autorizadas na configuração do backend, no máximo 4.096 IPs por atualização e 16 destinos simultâneos; UDP limitado a dois segundos por tentativa e uma repetição. A coleta envia lotes pela API HTTPS. Nenhuma porta de entrada da Internet é necessária.

Consulte `THIRD-PARTY-NOTICES.txt` para a licença MIT da biblioteca SNMP incluída.
