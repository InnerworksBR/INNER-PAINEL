# 🌐 Portal Inner

O **Portal Inner** é uma plataforma centralizada de monitoramento e gestão, projetada para oferecer aos gestores de contrato uma visão clara, técnica e em tempo real de toda a sua infraestrutura. 

O projeto visa dar autonomia ao cliente e reduzir a carga de solicitações manuais ao time técnico, centralizando dados do **Microsoft 365, Servidores Físicos, Redes e Chamados GLPI**.

---

## 🎯 Objetivos do Projeto

* **Centralização:** Um único ponto de acesso para informações de diferentes fontes.
* **Autonomia:** Gestores visualizam métricas sem depender de relatórios manuais.
* **Transparência:** Dados reais sobre saúde do ambiente e consumo de licenças.
* **Real-time:** Atualização instantânea de métricas críticas via WebSockets.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Frontend** | [Vite](https://vitejs.dev/) + [React](https://reactjs.org/) |
| **Backend** | [Fastify](https://www.fastify.io/) (Node.js) |
| **Banco de Dados** | [Supabase DB](https://supabase.com/) (PostgreSQL) |
| **Real-time** | [Supabase Realtime](https://supabase.com/docs/guides/realtime) |
| **Monitoramento** | [Zabbix](https://www.zabbix.com/)|
| **Integrações** | Microsoft Graph API & GLPI API |

---

## 📋 Funcionalidades Principais

### 📊 Dashboards e Módulos
* **Dashboard Geral:** Cards de status (MS365, Servidores, Saúde Geral) e alertas rápidos.
* **Microsoft 365:** Monitoramento de licenças (uso vs. disponível), usuários ativos e armazenamento do SharePoint via **Microsoft Graph API**.
* **Servidores Físicos:** Visualização em tempo real de **CPU, Memória e Rede** através de um agente Python dedicado.
* **Gestão de Chamados (GLPI):** Indicadores de SLA, volume de chamados, média de tempo de resolução e top requerentes.
* **Rede:** Status de conectividade e latência.
* **Documentação Técnica:** Visualizador centralizado com filtros por categoria, cliente e busca por palavra-chave.

### 👤 Perfis de Acesso
1.  **Gestor de Contrato:** Visualização total dos dados técnicos do seu contrato (Leitura).
2.  **Administrador Inner:** Gerenciamento de acessos, cadastro de clientes e contratos.

---

## 🏗️ Arquitetura da Solução

O sistema foi desenhado para ser escalável e performático:

1.  **Coleta de Dados:** Via Zabbix.
2.  **Processamento:** O **Fastify** consome APIs REST de terceiros (Zabbix, Graph API, GLPI).
3.  **Sincronização:** Os dados são persistidos no **Supabase**.
4.  **Interface:** O Frontend escuta as mudanças via **Supabase Realtime**, atualizando os gráficos sem necessidade de recarregar a página.

---

## 🔒 Segurança

* **Isolamento de Dados:** Filtros rigorosos por ID de contrato/cliente no banco de dados.
* **Autenticação:** Sistema de login com JWT e controle de permissões por nível.
* **Criptografia:** Toda a comunicação entre agentes, backend e frontend é criptografada.
* **Tokens:** Uso de tokens específicos para autenticação dos agentes de monitoramento.

---

## 🚀 Como Executar o Projeto (Desenvolvimento)

### Pré-requisitos
* Node.js (v18+)
* Zabbix
* Supabase Local
* API Microsoft Graph
* API GLPI



## 🔮 Considerações Futuras
* Expansão para novos módulos de infraestrutura.
* Relatórios automatizados em PDF para gestores.
* Aplicativo mobile para alertas push.

---
© 2026 Portal Inner - Todos os direitos reservados.
