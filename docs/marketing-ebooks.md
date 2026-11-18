# E-books e campanhas no Painel

O site lê os materiais publicados e encaminha o formulário ao backend. O Painel concentra os rascunhos, os arquivos privados, os contatos e os disparos. Os administradores usam **Marketing**. O catálogo público fica em **E-books**.

## Configuração

| Aplicação | Variável | Uso |
|---|---|---|
| Backend | SITE_MARKETING_ENABLED | Habilita o catálogo, o Painel e o processamento de e-mails. Padrão false. |
| Backend | SITE_MARKETING_SITE_ORIGIN | Origem do site usada pelo Painel nos links públicos. |
| Backend | SITE_MARKETING_PUBLIC_API_ORIGIN | Origem HTTPS do backend usada nos links de download, confirmação e descadastro. |
| Backend e site | SITE_MARKETING_FORM_KEY | Mesmo valor aleatório em ambos. O site o envia ao backend em requisições do servidor. |
| Backend | SITE_MARKETING_TOKEN_SECRET | Valor aleatório usado para assinar os links de e-mail. Mantenha-o estável durante a validade dos links, inclusive os de descadastro. |
| Backend | SITE_MARKETING_DELIVERY_SMTP_* | HOST, PORT, USER, PASSWORD e FROM para a entrega do e-book. |
| Backend | SITE_MARKETING_CAMPAIGN_SMTP_* | HOST, PORT, USER, PASSWORD e FROM para as campanhas, com endereço remetente próprio. |
| Backend | SITE_MARKETING_EVENTS_SECRET | Chave aleatória para o retorno autenticado de entregas, rejeições permanentes e reclamações. |
| Site | SITE_MARKETING_API_ORIGIN | Origem do backend, sem /api. |

Os três segredos devem ter pelo menos 32 caracteres sem espaços. Guarde as credenciais no ambiente do servidor. Configure autenticação dos domínios remetentes e garanta que o provedor permita os dois tipos de e-mail. As campanhas enviam os cabeçalhos de descadastro em um clique. O remetente SMTP precisa preservar esses cabeçalhos e cobri-los com DKIM.

### Conectar uma caixa do Microsoft 365

1. Aplique a migração `backend/migration_031_site_marketing_microsoft.sql` após a 030. No Microsoft Entra, registre um aplicativo para a organização. Em **Permissões de APIs → Adicionar uma permissão → Microsoft Graph → Permissões delegadas**, selecione **SMTP.Send** e **offline_access**. Cadastre uma plataforma **Web** e use a URL do Painel seguida de `/admin/marketing/email` como URI de redirecionamento. Em produção, use `https://portal.innerworks.com.br/admin/marketing/email`. O backend solicita o escopo SMTP do recurso Outlook, `https://outlook.office.com/SMTP.Send`, e a renovação do acesso. A caixa remetente deve permitir SMTP autenticado conforme as políticas da organização. [Permissão SMTP.Send](https://learn.microsoft.com/en-us/graph/permissions-reference#smtpsend) · [OAuth no Exchange Online](https://learn.microsoft.com/pt-br/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth)
2. No backend, configure `SITE_MARKETING_PANEL_ORIGIN` com a origem do Painel. Salve o ID do diretório em `SITE_MARKETING_MICROSOFT_TENANT_ID`, o ID do aplicativo em `SITE_MARKETING_MICROSOFT_CLIENT_ID` e o **Valor** do segredo do aplicativo em `SITE_MARKETING_MICROSOFT_CLIENT_SECRET`. O aplicativo usa uma chave derivada de `SITE_MARKETING_TOKEN_SECRET` para criptografar os tokens da conexão.
3. Aplique também `backend/migration_032_site_marketing_shared_mailbox.sql`. Em **Marketing → Configurações de e-mail**, informe o endereço da caixa remetente. Para uma caixa compartilhada, preencha **Conta Microsoft para autenticação** com a conta de usuário que tem permissão para enviar por ela. Clique em **Conectar Microsoft** e selecione essa conta na Microsoft. O Painel valida a autenticação do SMTP e usa a caixa remetente para a entrega dos e-books e para as campanhas. Use a prévia de uma campanha e uma solicitação de e-book em homologação para testar o recebimento e a permissão de envio da caixa compartilhada.
4. Se a autorização expirar ou for revogada, volte a **Configurações de e-mail** e reconecte a caixa. A fila retoma os envios pendentes após a conexão. O processamento dá prioridade aos e-books e compartilha a cadência de envio entre instâncias do backend. O Exchange aplica limites por caixa e por organização para destinatários externos. [Limites de envio do Exchange](https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-sending-limits-troubleshoot)

O status **Aceito pelo SMTP** significa que o servidor aceitou a mensagem para processamento. **Entregue** depende do retorno do provedor. A integração de eventos normaliza o evento para um POST JSON em /api/public/ebooks/events com eventId, kind e jobId. Use kind igual a delivered, bounce permanente ou complaint. O cabeçalho x-marketing-event-signature contém HMAC SHA-256 hexadecimal de eventId, kind e jobId, separados por LF, usando SITE_MARKETING_EVENTS_SECRET. Envie o UUID do job em minúsculas. Identifique-o pelo cabeçalho X-Innerworks-Job ou pelo UUID no Message-ID. Valide a assinatura do provedor antes de normalizar o evento. Reenvios do mesmo eventId são idempotentes.

A fila de e-books é independente da fila de campanhas. O serviço retoma trabalhos pendentes após reiniciar. Quando o SMTP pode ter aceitado a mensagem, o trabalho fica **Incerto** para conferência com o provedor. Uma pausa ou um descadastro interrompe os envios pendentes. Envios que já entraram em processamento podem concluir. Os links de descadastro e o retorno autenticado do provedor continuam disponíveis durante a manutenção do Painel ou com o módulo pausado.

## Homologação e liberação

1. Use um Supabase isolado com as migrações do Painel e aplique backend/migration_030_site_marketing.sql. Execute backend/tests/site-marketing.integration.sql com ON_ERROR_STOP. Ele reverte seus dados de teste.
2. Rode o Painel e o site com o backend de homologação, ligado ao Supabase local. Para testar com Mailpit local, configure os dois canais SMTP com 127.0.0.1, a porta SMTP local e remetentes diferentes. Para endereços locais sem TLS, deixe usuário e senha vazios.
3. Rode node --test tests/site-marketing.flow.e2e.mjs no diretório backend. Defina MARKETING_E2E_API_URL, MARKETING_E2E_SITE_URL, MARKETING_E2E_PANEL_URL e MARKETING_E2E_MAILPIT_URL com URLs locais. MARKETING_E2E_ACCOUNTS aponta para um JSON com editor.email e editor.password de um administrador de teste. MARKETING_E2E_BROWSER_DIR aponta para o diretório que contém a instalação de Playwright. O teste usa Edge e endereços sintéticos. MARKETING_E2E_EVENT_KEY habilita a verificação de retorno de entrega e deve corresponder à chave de teste do backend.
4. Em produção, confirme a cópia de recuperação do banco e dos objetos de Storage. A migração é aditiva e mantém as funções privadas disponíveis apenas para service_role. Ajuste os limites de corpo do proxy para aceitar o PDF de até 20 MiB em upload.
5. Aplique a migração, suba as aplicações e valide os remetentes. Habilite o módulo após comprovar que o site chama o backend e que ambos os endereços remetentes estão operacionais. Faça a verificação de produção com um material de teste e endereços controlados pela equipe.
6. Para interromper campanhas pendentes, use Pausar no Painel. Para retirar um material, use Retirar do ar. A retirada impede novos pedidos e o acesso aos links existentes; o arquivo e o histórico ficam disponíveis para administração.
