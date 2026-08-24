# Skill: Implementação de Features e Fixes

## Descrição
Esta skill define o fluxo de trabalho padrão para implementar novas features ou correções (fixes) no projeto. Ela garante que todas as implementações sejam devidamente documentadas, planejadas e executadas de forma estruturada.

## Gatilho (Trigger)
Ative esta skill sempre que o usuário solicitar a criação de uma nova feature, correção de bug ou qualquer outra modificação estrutural no sistema.

## Regras de Execução 

### 1. Preparação do Diretório
- Acesse a pasta `implementações/` na raiz do projeto.
- Verifique os números das pastas já existentes para determinar o próximo número sequencial (ex: se já existe `001-login`, o próximo será `002`). Caso a pasta `implementações` não exista, ela deve ser criada.
- Crie uma nova pasta com o formato numérico e nome: `[numero]-[nome-da-implementacao]` (ex: `002-recuperacao-de-senha`).

### 2. Criação de Arquivos de Planejamento
Dentro da nova pasta de implementação, você deve criar obrigatoriamente dois arquivos:

#### A. `spec.md` (Especificação Detalhada)
Este arquivo deve conter os detalhes da feature ou correção:
- **Título**: O nome da implementação.
- **Contexto / Objetivo**: O motivo dessa feature ou correção.
- **Requisitos Técnicos**: Arquitetura, tecnologias, dependências e padrões.
- **Áreas Afetadas**: Frontend, Backend, Banco de Dados, etc.
- **Critérios de Aceite**: O que determina que a implementação está concluída.

#### B. `tasks.md` (Tarefas e Execução)
Este arquivo será a lista de verificação passo a passo (checklist). Ele DEVE seguir este padrão:
- Lista numerada de tarefas (`- [ ] 1. Tarefa X`).
- Indicação **clara e explícita** de quais tarefas são independentes e podem ser executadas **em paralelo utilizando subagentes**.

**Exemplo de formato para o `tasks.md`:**
- [ ] 1. Atualizar schema do banco de dados para a feature.
- [ ] 2. Criar controllers e rotas no backend *(Pode ser feito em paralelo com a tarefa 3 usando subagente)*.
- [ ] 3. Criar componentes visuais no frontend *(Pode ser feito em paralelo com a tarefa 2 usando subagente)*.
- [ ] 4. Integrar Frontend com Backend e realizar testes finais *(Depende de 2 e 3)*.

### 3. Validação com o Usuário
Após a criação da pasta e geração do `spec.md` e `tasks.md`:
- Apresente um resumo do plano de implementação para o usuário.
- Aguarde o feedback e a aprovação antes de iniciar a execução real (escrita de código).

### 4. Execução
- Durante a execução, siga estritamente as etapas do `tasks.md`.
- Invoque e utilize os **subagentes** de forma simultânea para resolver as tarefas assinaladas como paralelas.
- Mantenha o arquivo `tasks.md` atualizado, marcando as tarefas com `[x]` conforme forem sendo concluídas.
