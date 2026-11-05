# Relatórios mensais de chamados

O backend processa o mês anterior a partir das 8h do primeiro dia, no fuso de São Paulo. Executa novamente a cada hora e ao iniciar; meses desde a ativação são recuperados se o servidor ficou indisponível. Para cada empresa habilitada, consulta a entidade GLPI, calcula indicadores e solicita à OpenAI uma análise de agregados. O cliente encontra os relatórios em **Chamados GLPI → Relatórios mensais**.

Para testar antes do próximo fechamento, use **Gerar relatório agora** na tela de chamados. A prévia considera o mês atual até o momento da coleta, fica salva no histórico e não envia e-mail. A primeira prévia de cada mês é reutilizada nas consultas seguintes, sem nova chamada à OpenAI; o relatório definitivo é armazenado separadamente. Ela precisa das integrações GLPI e OpenAI configuradas, mas não depende do SMTP nem dos destinatários. Se a geração ou gravação falhar, novas tentativas aguardam pelo menos um minuto, com espera crescente após falhas repetidas.

## Configuração

1. Aplique `backend/migration_026_monthly_glpi_reports.sql` e depois `backend/migration_027_glpi_preview_reports.sql` no banco Supabase do ambiente desejado, usando o processo de migração do ambiente.
2. Configure no backend `GLPI_API_URL`, `GLPI_API_TOKEN`, `GLPI_USER_TOKEN`, `OPENAI_API_KEY`, `OPENAI_REPORT_MODEL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` e `PORTAL_URL`. O endereço do portal é a origem pública, sem `/app`. A porta 465 usa TLS direto; nas demais, o servidor SMTP deve oferecer STARTTLS.
3. Reinicie o backend para carregar as variáveis. Na administração, abra **Empresas → Integrações** da empresa, configure a entidade GLPI e habilite **Relatório mensal de chamados** com os e-mails específicos separados por vírgula ou ponto e vírgula.
4. Confira o histórico de processamento na mesma configuração e o relatório na visualização da empresa. A ativação não gera relatórios de meses anteriores ao mês de ativação.

As credenciais da API OpenAI e do SMTP são do servidor e não devem ser inseridas no navegador ou versionadas. A API OpenAI é cobrada conforme o modelo e o uso. A geração exige que a resposta GLPI inclua o total paginado em `Content-Range`; se o total estiver ausente ou mudar durante a coleta, o processamento falha para evitar totais incompletos.

## Operação e falhas

Os estados e as tentativas ficam nas tabelas `monthly_glpi_reports` e `monthly_glpi_report_deliveries`. Falhas de GLPI, OpenAI ou configuração ficam registradas no relatório e são repetidas com espera crescente. As mensagens são individuais; o estado `sent` significa que o SMTP aceitou a mensagem, não que o destinatário a leu. Uma rejeição SMTP conhecida é repetida até seis tentativas. Uma interrupção de conexão com resultado incerto fica em `uncertain` e não é reenviada automaticamente: confira com o destinatário antes de tomar qualquer ação manual.

Antes de uma tentativa, o sistema confere os destinatários ativos: endereços removidos são cancelados e os novos endereços são incluídos enquanto houver uma entrega pendente. A alteração da lista não dispara reenvio de relatórios cuja entrega já terminou. Um envio iniciado simultaneamente à alteração pode já ter sido entregue ao serviço SMTP.

Os números mensais usam datas de abertura e solução; pendências são o estado atual no momento da coleta. Quando falta a data de abertura, a data de criação do registro é usada e a limitação é informada. Quando um chamado solucionado não tem data de solução, o relatório informa a limitação. O sistema não calcula percentuais de SLA sem dados suficientes. A análise recebe somente contagens, categorias e prioridades agregadas; não recebe nomes, títulos ou histórico dos chamados. O texto descreve o atendimento observado, sem recomendar ações ou inferir a saúde de toda a infraestrutura. Relatórios antigos mantêm o original no banco, e padrões conhecidos de recomendações são filtrados na apresentação ao cliente e no e-mail.

Para verificar a implementação sem serviços externos, execute no backend `npm test` e no frontend `npm test` e `npm run build`. Os testes simulam OpenAI, GLPI e SMTP; validar o ambiente integrado exige credenciais e dados reais, sem necessidade de enviá-los ao chat.
