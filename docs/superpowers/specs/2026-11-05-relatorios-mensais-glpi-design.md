# Relatórios mensais de chamados GLPI

## Objetivo

Gerar automaticamente um relatório mensal de chamados para cada empresa habilitada, com indicadores apurados pelo sistema e análise textual produzida por um modelo da OpenAI. O relatório fica disponível na tela de chamados e é enviado aos destinatários específicos configurados para a empresa.

## Experiência

- A tela de chamados exibe o relatório mais recente e um histórico por mês, com indicadores, análise e data de geração. Estados de carregamento, ausência e falha são explícitos.
- A administração configura a habilitação do relatório mensal e uma lista específica de destinatários para cada empresa. Os destinatários não são inferidos de usuários ou do e-mail geral da empresa. Configurações anteriores de notificações não são alteradas.
- Um e-mail individual informa o período, apresenta um resumo e leva à página autenticada do relatório. O conteúdo deve ser legível em texto simples e HTML; dados de outras empresas nunca são incluídos.

## Período e dados

O período corresponde ao mês civil anterior no fuso `America/Sao_Paulo`, com início inclusivo e fim exclusivo. A execução começa no dia 1 às 08:00 nesse fuso. O serviço consulta o GLPI usando a entidade associada à empresa e pagina até comprovar o fim do conjunto, sem o teto de 5.000 chamados da sincronização atual. Caso a coleta esteja incompleta, a geração falha e é tentada novamente; nunca publica totais parciais como completos.

O relatório identifica claramente a população e o momento de cada indicador:

- Chamados abertos no mês: data de abertura dentro do período.
- Chamados solucionados no mês: data de solução dentro do período, inclusive chamados abertos anteriormente.
- Chamados ainda não solucionados: situação observada no momento da coleta, com data e hora; não é um retrato histórico do fim do mês.
- Categorias e prioridades: distribuição dos chamados abertos no mês, com rótulo para valores ausentes.
- SLA e tempos só aparecem quando as datas e os dados de SLA disponíveis sustentarem o cálculo; caso contrário, a indisponibilidade é indicada sem inventar números.

O acesso aos dados é isolado por empresa. O relatório salvo contém um retrato dos indicadores e da análise, para não mudar quando o GLPI for atualizado posteriormente.

## Geração com IA

O backend calcula os indicadores; a IA recebe somente agregados necessários, período e informações contextuais mínimas. Não são enviados nomes de requerentes, textos de chamados, credenciais ou históricos individuais. A Responses API da OpenAI recebe instruções para produzir, em português, resumo executivo, tendências observáveis e recomendações proporcionais aos dados, sem inventar fatos, causas ou números. Não alegar tendência temporal sem base comparativa disponível. O modelo e a chave são configurados no servidor.

Se a OpenAI falhar ou retornar conteúdo inválido, registrar a falha e tentar novamente; não marcar um texto local como se fosse análise de IA. A geração e o envio permanecem pendentes até haver um relatório válido.

## Agendamento, persistência e entrega

O agendador existente inicia o processamento periódico e recupera meses pendentes após indisponibilidade do serviço. Uma chave única por empresa e período, operações atômicas no banco e uma concessão com expiração impedem que múltiplas instâncias gerem simultaneamente o mesmo relatório. Estado, tentativas, erros e horário da última tentativa são persistidos. Falhas de uma empresa não interrompem as demais.

Cada destinatário possui seu próprio estado de entrega; sucessos já registrados não são reenviados em novas tentativas. O envio usa SMTP configurado no servidor. Como SMTP não garante deduplicação transacional após falha de conexão com resultado incerto, o sistema deve registrar esse estado como incerto para revisão, sem prometer entrega exatamente uma vez nem reenviar automaticamente um resultado ambíguo. Falhas conhecidas podem ser repetidas com espera crescente e limites registrados.

Empresas sem GLPI configurado, sem relatório habilitado ou sem destinatários válidos não recebem envios. Chave OpenAI ou SMTP ausentes geram estado de configuração pendente, sem fingir sucesso. A migração necessária é aditiva e aplica isolamento de dados no banco; endpoints administrativos exigem papel de administrador e endpoints de relatórios sempre validam a empresa, inclusive para administradores.

## Verificação

Testar limites de mês e fuso, paginação e falhas do GLPI, métricas por data de abertura e solução, dados incompletos, segregação entre empresas, conteúdo da solicitação à OpenAI, recuperação e concorrência do agendamento, tentativas e estados de envio, validação dos destinatários e visualização do relatório. Verificar build e testes pertinentes de backend e frontend. As integrações externas são simuladas nos testes; uma execução real depende de credenciais e configuração de ambiente.

## Operação

Documentar variáveis de ambiente para OpenAI, modelo, SMTP e URL pública do portal, aplicação da migração e diagnóstico de falhas. O custo da API depende do modelo e do volume processado. Nenhum envio real é necessário para validar a implementação local.
