# Inner Network Agent — reparo de permissões do instalador 1.0.1

Data: 21/10/2026. Escopo: corrigir acesso negado ao estado de vinculação durante instalação ou reinstalação, preservando os dados locais.

## Causa confirmada

O instalador 1.0.0 executava `icacls` recursivamente com `/inheritance:r` e concessões `(OI)(CI)F`. Essas flags se destinam a diretórios. Em arquivos existentes, a rotina removia as permissões herdadas sem adicionar uma concessão aplicável ao arquivo, deixando sua DACL vazia. O comando reportava sucesso, mas a leitura seguinte de `pairing-status.json` falhava com `UnauthorizedAccessException`, HRESULT `0x80070005`.

A reprodução foi executada em um diretório temporário exclusivo, substituindo as identidades privilegiadas pela identidade proprietária do teste. O mesmo comando deixou a DACL do arquivo vazia e produziu exatamente a exceção relatada. Uma concessão direta `:F`, sem flags de herança, restaurou a leitura dos mesmos bytes. Uma reprodução separada de leitura concorrente produziu `IOException` de compartilhamento, diferente deste incidente.

O diagnóstico informado pelo operador também confirmou token elevado de Administrador, arquivo regular sem atributo de criptografia, serviço parado e nenhuma ACE listada para o arquivo. Portanto, repetir a elevação ou reinstalar o pacote antigo não corrigia a causa. As migrations do backend não modificam essa DACL local.

Referência de sintaxe: [icacls — Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls).

## Recuperação

Executar o instalador 1.0.1 ou posterior como administrador, por cima da instalação existente. O reparo deve cobrir arquivos anteriores, incluindo estado de vínculo, SQLite e segredos, e a herança em diretórios para novos arquivos. Não apagar `C:\ProgramData\InnerWorks\NetworkAgent`. O instalador 1.0.0 pode recriar as permissões vazias.

## Validação desta correção

- `InstallerAclPolicyTests`: 3/3 aprovados, sem testes ignorados. O teste inicial falhou com acesso negado usando a rotina antiga, antes da troca da política. A versão corrigida preserva os bytes dos arquivos de estado existentes, permite leitura/gravação pelo SID autorizado, concede permissões diretas a arquivos e herdáveis a diretórios, e mantém a herança de arquivos futuros. Um junction é recusado antes de alterar a raiz ou o alvo externo.
- Validação independente após a última alteração de código: `dotnet test agent/Inner.Network.Agent.Tests/Inner.Network.Agent.Tests.csproj --no-restore -v minimal` — **65/65 aprovados, 0 falhas, 0 ignorados**, saída 0. A suíte usa Windows real, arquivos temporários e o SID proprietário do teste para exercitar a política sem elevar o processo.
- A revisão independente com GPT-6 Luna confirmou a política produtiva restrita a SYSTEM e Administradores, proteção de DACL, recusa de reparse points e preservação de conteúdo. O reparo da árvore ocorre depois de parar o serviço, evitando concorrência com a gravação de segredos. A revisão identificou uma checagem redundante por `Exists` antes do reparo de propriedade; ela foi removida porque acesso negado pode ser confundido com ausência. O parecer final não deixou achado importante aberto.

## Pacote corrigido

O build final `./agent/build-network-agent.ps1 -ApiBaseUrl 'https://innerworks-painelbackend.zvzr4n.easypanel.host'` terminou com saída 0 após a última alteração de código. O executável informa versão de arquivo `1.0.1.0` e mantém o manifesto `requireAdministrator`. O ZIP contém o mesmo executável, verificado pelo SHA-256, junto dos dois scripts opcionais, guia atualizado e avisos de terceiros. O payload embutido inclui executável do serviço, SQLite nativo e configuração HTTPS da API com o diretório de dados original.

| Arquivo entregue no checkout principal | Bytes | SHA-256 |
|---|---:|---|
| `agent/artifacts/InnerNetworkAgent-Setup-1.0.1.exe` | 99.877.721 | `5B7190413DA66F025BC618BD0F04C86A61983E978F333208A7BBEC8777700D7C` |
| `agent/artifacts/InnerNetworkAgent-Setup.exe` | 99.877.721 | `5B7190413DA66F025BC618BD0F04C86A61983E978F333208A7BBEC8777700D7C` |
| `agent/artifacts/Inner.Network.Agent-win-x64.zip` | 94.466.506 | `AB64639D01931BA346AFF03751C1C8942C8834FFE8F6F7531B366F7F8B7ADF92` |
| `backend/artifacts/Inner.Network.Agent-win-x64.zip` | 94.466.506 | `AB64639D01931BA346AFF03751C1C8942C8834FFE8F6F7531B366F7F8B7ADF92` |

Os quatro arquivos locais foram conferidos após a cópia. Os binários são ignorados pelo Git: o push dos fontes não substitui o pacote de download de um backend já publicado. O executável com sufixo `1.0.1` permite identificar o arquivo corrigido ao copiá-lo para a máquina cliente.

## Limites de validação

O processo de desenvolvimento não está elevado. A execução nativa de `takeown.exe /F <caminho exato> /A` em arquivo pertencente a SYSTEM e a instalação real do serviço dependem da validação do operador. O código valida o caminho dentro da pasta de dados e recusa reparse points antes dessa recuperação; falhas são exibidas e não são tratadas como falta de internet. Não foi concedido acesso a usuários comuns.

Uma tentativa adicional de simular recuperação privilegiada usando uma ACE `OWNER RIGHTS` que nega leitura de permissões não foi mantida na suíte: o próprio callback não elevado não conseguiu reparar esse cenário. Esse bloqueio adicional não está presente na DACL vazia do incidente. A lacuna do teste nativo permanece explícita; nenhum teste foi marcado como aprovado por ter sido ignorado. Não houve operação de API, banco ou rede de produção nem registro de serviço no ambiente de desenvolvimento.

## Arquivos temporários de diagnóstico

A política de execução recusou a limpeza das duas reproduções iniciais com o motivo `blocked by policy`. Três fixtures da tentativa não elevada com `OWNER RIGHTS` também ficaram com permissões restritas. Esses diretórios contêm somente dados sintéticos do teste, no ambiente de desenvolvimento:

```text
C:\Users\CristianPaxur\AppData\Local\Temp\inner-network-file-access-df085624fe9640248ab557c3eebb062b
C:\Users\CristianPaxur\AppData\Local\Temp\inner-network-acl-repro-53697feb02a248ca8230eca0a5f816ab
C:\Users\CristianPaxur\AppData\Local\Temp\inner-agent-acl-aecfe823bd2b4d0f8a8b7b31e7d686d3
C:\Users\CristianPaxur\AppData\Local\Temp\inner-agent-acl-b4b5f2adc0314dcd955a8d99787aa050
C:\Users\CristianPaxur\AppData\Local\Temp\inner-agent-acl-c8874493e79c406b9ff80ee24d3156b2
```
