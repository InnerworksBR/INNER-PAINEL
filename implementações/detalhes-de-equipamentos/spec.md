# Spec — Detalhes Técnicos de Equipamentos e Servidores para o Cliente

## 1. Objetivo

Criar uma camada de inventário técnico exibível ao cliente para que, ao clicar em um servidor, máquina virtual ou equipamento de rede, ele consiga entender:

1. **o que aquele ativo é**;
2. **quais são suas características técnicas principais**;
3. **qual função ele exerce no ambiente**;
4. **quais informações foram coletadas automaticamente pelo Zabbix e quais foram complementadas manualmente pelo time interno**.

A feature também deve permitir que o administrador defina quais ativos podem ser visualizados pelo cliente e complete manualmente campos que não venham do Zabbix.

## 2. Contexto atual identificado no projeto

### Frontend

- A tela de servidores já existe em `web/src/pages/paginasClient/Servidores/servidores.jsx`.
- A tela de rede já existe em `web/src/pages/paginasClient/Rede/rede.jsx`.
- Hoje o cliente enxerga principalmente métricas operacionais:
  - CPU
  - memória
  - disco
  - status
  - IP/localização/tipo, no caso de rede
- Não existe hoje uma experiência dedicada para abrir a “ficha” de um ativo.

### Backend e sincronização

- Servidores são persistidos em `servers`.
- Equipamentos de rede são persistidos em `network_devices`.
- A sincronização de Zabbix já coleta e grava dados operacionais.
- Para servidores, já existem dados como `hostname`, `zabbix_host_id`, disponibilidade, CPU, memória, disco e alertas.
- Para rede, já existem `device_name`, `device_type`, `ip_address`, `location`, `status` e campos derivados.
- Ainda não existe uma estrutura de inventário descritivo unificada para guardar:
  - fabricante;
  - modelo;
  - número de série;
  - sistema operacional;
  - versão de firmware;
  - ambiente/função de negócio;
  - descrição amigável;
  - se o item deve ou não ser exibido ao cliente.

## 3. Problema a resolver

O cliente vê que um host existe e se está saudável, mas não entende necessariamente:

- se é um servidor físico, uma VM, um firewall, um switch ou outro ativo;
- qual sistema ou serviço ele suporta;
- qual modelo ou firmware está em uso;
- por que aquele equipamento é importante para a operação.

Isso cria um painel tecnicamente correto, porém pouco explicativo. A informação está viva, mas ainda não tem contexto.

## 4. Proposta de solução

Criar um recurso de **detalhes de ativo** com duas frentes:

### 4.1. Experiência do cliente

Nas telas de Servidores e Rede, o cliente poderá clicar em um item e abrir um modal, drawer ou página de detalhe com:

- identificação do ativo;
- classificação do ativo;
- resumo em linguagem humana;
- função no ambiente;
- dados técnicos;
- origem dos dados;
- data da última atualização.

### 4.2. Experiência do administrador

No painel admin, deve existir uma área para o time interno:

- escolher quais ativos ficam visíveis para o cliente;
- editar informações complementares quando o Zabbix não trouxer esses dados;
- revisar dados importados automaticamente;
- adicionar explicações de propósito e contexto de negócio;
- diferenciar o que é dado automático e o que é dado manual.

## 5. Princípio de modelagem recomendado

### 5.1. Separar “telemetria” de “cadastro de inventário”

As tabelas atuais (`servers` e `network_devices`) devem continuar sendo a camada operacional, alimentada principalmente por sincronizações.

A nova feature deve introduzir uma camada complementar de **metadados de ativo**, responsável por informações semânticas e de apresentação ao cliente.

### 5.2. Evitar duplicar o mundo

Em vez de criar uma tabela completamente isolada e desconectada, a modelagem ideal deve ligar cada ficha a um ativo monitorado existente sempre que possível.

Exemplo conceitual:

```text
servers / network_devices
        └── asset_profiles / asset_details
              ├── dados técnicos ampliados
              ├── descrição funcional
              ├── visibilidade para cliente
              └── origem/manual_override
```

## 6. Tipos de ativo previstos

A solução deve suportar pelo menos:

- servidor físico;
- máquina virtual;
- switch;
- roteador;
- firewall;
- access point;
- impressora ou sensor, se continuarem sendo trazidos como ativos de rede;
- tipo genérico “outro”.

## 7. Campos sugeridos para a ficha técnica

### 7.1. Campos de identificação

- `display_name`
- `asset_type`
- `source_type` (`server`, `network_device`, futuramente outros)
- `source_id`
- `company_id`
- `customer_visible`
- `is_active`

### 7.2. Campos técnicos

- `manufacturer`
- `model`
- `serial_number`
- `operating_system`
- `operating_system_version`
- `firmware_version`
- `cpu_model`
- `cpu_cores`
- `memory_capacity_gb`
- `storage_capacity_gb`
- `ip_address`
- `mac_address`
- `virtualization_platform`
- `physical_or_virtual`
- `location`

### 7.3. Campos funcionais

- `business_purpose`
- `technical_purpose`
- `environment` (`produção`, `homologação`, `backup`, etc.)
- `criticality`
- `notes_for_customer`

### 7.4. Campos de governança/origem

- `data_source`
- `auto_synced_fields`
- `manual_override_fields`
- `last_synced_at`
- `last_reviewed_at`
- `updated_by`

## 8. Origem dos dados

### 8.1. Dados vindos do Zabbix

Sempre que disponíveis, a sincronização deve tentar preencher automaticamente campos como:

- hostname/nome;
- IP;
- sistema operacional;
- descrição técnica básica;
- modelo/hardware;
- número de série;
- firmware, em especial para rede;
- informações de virtualização;
- CPU/memória quando houver itens adequados.

### 8.2. Dados manuais

O admin deve poder preencher campos que o Zabbix não fornecer ou que precisam de contexto humano, especialmente:

- finalidade do ativo;
- descrição para cliente;
- criticidade;
- localização amigável;
- classificação correta do ativo;
- correções de exibição.

### 8.3. Regra de precedência recomendada

- dados manuais marcados como override não devem ser sobrescritos por sincronizações futuras;
- dados automáticos continuam sendo atualizados em campos livres ou não sobrescritos;
- a interface admin deve deixar claro quais campos vieram do Zabbix e quais foram mantidos manualmente.

## 9. Experiência do cliente

### 9.1. Interação

- O nome do servidor/equipamento deve se tornar clicável.
- Ao clicar, abrir uma visão de detalhe.
- A visão deve funcionar bem tanto para item com muitos dados quanto para item parcialmente documentado.

### 9.2. Conteúdo sugerido da visão

1. **Cabeçalho**
   - nome do ativo;
   - tipo;
   - status atual;
   - ambiente;
   - criticidade.

2. **O que é / para que serve**
   - resumo textual amigável;
   - função principal no ambiente.

3. **Ficha técnica**
   - modelo;
   - fabricante;
   - SO ou firmware;
   - físico/virtual;
   - IP;
   - localização;
   - demais atributos pertinentes ao tipo.

4. **Telemetria atual**
   - para servidores: CPU, memória, disco e status;
   - para rede: status, IP e eventualmente uptime ou outros dados existentes.

5. **Atualização**
   - última sincronização automática;
   - última revisão manual, quando houver.

### 9.3. Exibição condicional

- Campos vazios não devem poluir a tela.
- Quando quase não houver dados, exibir um estado elegante como “informações técnicas ainda não cadastradas”.
- O cliente nunca deve ver ativos marcados como não visíveis.

## 10. Experiência do administrador

### 10.1. Local recomendado no admin

Adicionar uma nova área administrativa dedicada, por exemplo:

- menu **Inventário**;
- ou seção dentro de **Empresas** com acesso por empresa.

A recomendação mais forte é criar uma área própria de **Inventário**, porque a feature tende a crescer e atravessar servidores, rede e futuros tipos de ativos.

### 10.2. Funcionalidades administrativas

- listar ativos sincronizados por empresa;
- filtrar por tipo, visibilidade, origem e status de preenchimento;
- abrir edição da ficha do ativo;
- ativar/desativar visibilidade para cliente;
- preencher descrições e campos técnicos manuais;
- revisar dados trazidos automaticamente;
- sinalizar ativos “sem ficha suficiente”.

### 10.3. Sugestão de colunas na listagem admin

- ativo;
- tipo;
- origem (`Servidor`, `Rede`);
- empresa;
- visível ao cliente;
- preenchimento da ficha;
- última sincronização;
- última revisão;
- ações.

## 11. Requisitos funcionais

1. O cliente deve conseguir abrir detalhes de servidores e equipamentos de rede clicando no item.
2. Apenas ativos marcados como visíveis devem aparecer com detalhe acessível ao cliente.
3. O admin deve conseguir controlar a visibilidade por ativo.
4. O admin deve conseguir preencher manualmente dados técnicos e funcionais ausentes.
5. O sistema deve tentar aproveitar automaticamente dados disponíveis no Zabbix.
6. O sistema deve separar claramente dados automáticos de dados manuais.
7. A sincronização não deve apagar overrides manuais sem intenção explícita.
8. A experiência deve suportar tanto servidores físicos quanto VMs e equipamentos de rede.

## 12. Requisitos não funcionais

1. **Segurança multi-tenant:** ativos e detalhes devem respeitar empresa em todas as consultas.
2. **Clareza:** o cliente deve entender o papel do ativo sem precisar interpretar somente métricas.
3. **Escalabilidade:** a modelagem deve permitir novos tipos de ativo no futuro.
4. **Manutenibilidade:** telemetria e inventário devem permanecer desacoplados o suficiente para evoluírem separadamente.
5. **Resiliência:** a falta de dados automáticos não pode impedir cadastro manual ou exibição parcial.

## 13. Modelagem de dados recomendada

### Opção recomendada

Criar uma tabela unificada, por exemplo `asset_profiles`, ligada aos registros de `servers` e `network_devices` por:

- `source_type`
- `source_id`
- `company_id`

Essa opção evita manter dois modelos diferentes de ficha técnica e facilita expansão futura.

### Campos mínimos da primeira versão

- `id`
- `company_id`
- `source_type`
- `source_id`
- `asset_type`
- `display_name`
- `customer_visible`
- `manufacturer`
- `model`
- `serial_number`
- `operating_system`
- `operating_system_version`
- `firmware_version`
- `physical_or_virtual`
- `business_purpose`
- `technical_purpose`
- `environment`
- `criticality`
- `location`
- `notes_for_customer`
- `auto_data` JSONB
- `manual_data` JSONB ou flags de override
- `last_synced_at`
- `last_reviewed_at`
- `created_at`
- `updated_at`

## 14. Integração com Zabbix

A sincronização deve ser revisada para buscar, quando disponíveis, itens adicionais por host e mapear campos úteis.

### Exemplos de informações potencialmente extraíveis

- sistema operacional;
- versão do sistema;
- hardware/modelo;
- vendor/fabricante;
- número de série;
- firmware;
- uptime;
- indicadores de ambiente virtual.

### Observação importante

Como o Zabbix pode variar muito por template e por cliente, a feature não deve depender exclusivamente dele. O desenho correto é **auto-preencher quando possível, permitir curadoria sempre**.

## 15. Pontos técnicos provavelmente impactados

### Frontend cliente

- `web/src/pages/paginasClient/Servidores/servidores.jsx`
- `web/src/pages/paginasClient/Rede/rede.jsx`
- novos componentes para modal/drawer de detalhe

### Frontend admin

- `web/src/rotas/rotas.jsx`
- `web/src/components/SidebarAdmin.jsx`
- nova tela administrativa de inventário
- componentes de formulário de ficha técnica

### Backend

- novas migrations
- novas rotas admin de inventário
- novas rotas client para detalhe de ativo
- `backend/src/services/zabbix-service.ts`
- possivelmente novos serviços para merge entre dado automático e manual

## 16. Critérios de aceite

1. O cliente consegue clicar em um servidor e abrir sua ficha.
2. O cliente consegue clicar em um equipamento de rede e abrir sua ficha.
3. A ficha mostra, quando disponíveis, tipo, modelo, sistema/firmware e finalidade.
4. Ativos não liberados pelo admin não aparecem ou não ficam acessíveis ao cliente.
5. O admin consegue editar campos complementares de um ativo.
6. O admin consegue marcar um ativo como visível ou não visível para o cliente.
7. Dados manuais permanecem após nova sincronização Zabbix.
8. Dados automáticos são reaproveitados quando existirem.
9. O modelo suporta ao menos servidores físicos, VMs e equipamentos de rede.
10. Toda consulta continua respeitando o isolamento por empresa.

## 17. Riscos e cuidados

### Risco 1 — tentar fazer o Zabbix virar CMDB completo

Mitigação: tratar Zabbix como fonte automática parcial, não como única fonte de verdade.

### Risco 2 — sobrescrever informação humana útil em novas sincronizações

Mitigação: separar campos automáticos de campos manuais e registrar overrides.

### Risco 3 — gerar uma tela muito técnica para o cliente

Mitigação: dividir bem “o que é / para que serve” de “ficha técnica”.

### Risco 4 — criar cadastros duplicados entre servidor e rede

Mitigação: usar uma tabela unificada de perfil de ativo.

### Risco 5 — mostrar ativo sensível ao cliente sem intenção

Mitigação: visibilidade deve ser opt-in ou, no mínimo, controlável e auditável pelo admin.

## 18. Resultado esperado

Ao final, o portal deixa de apenas dizer “este equipamento está online” e passa a explicar “o que ele é, por que existe e qual papel cumpre no ambiente”. Isso transforma telemetria em entendimento — e esse é um salto de produto bem relevante.
