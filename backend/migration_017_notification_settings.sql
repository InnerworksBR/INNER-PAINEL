-- =============================================================================
-- Migration 017: Criar tabela de configurações de notificação por empresa
-- =============================================================================
-- Esta tabela armazena as preferências de notificação de cada empresa,
-- permitindo configurar quais tipos de alertas serão enviados e para quais e-mails.
-- =============================================================================

-- Criar tabela de configurações de notificação
CREATE TABLE IF NOT EXISTS company_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    notify_critical_email BOOLEAN DEFAULT true,
    notify_daily_summary BOOLEAN DEFAULT true,
    notify_weekly_summary BOOLEAN DEFAULT false,
    notification_emails TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice único por empresa (cada empresa tem apenas uma configuração)
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_notification_settings_company_id
ON company_notification_settings(company_id);

-- Comentários para documentação
COMMENT ON TABLE company_notification_settings IS 'Configurações de notificação por empresa';
COMMENT ON COLUMN company_notification_settings.notify_critical_email IS 'Envia alertas críticos por e-mail imediato';
COMMENT ON COLUMN company_notification_settings.notify_daily_summary IS 'Envia resumo diário de status';
COMMENT ON COLUMN company_notification_settings.notify_weekly_summary IS 'Envia relatório semanal com métricas';
COMMENT ON COLUMN company_notification_settings.notification_emails IS 'Lista de e-mails para receber notificações (separados por vírgula)';

-- Habilitar RLS
ALTER TABLE company_notification_settings ENABLE ROW LEVEL SECURITY;

-- Policy para admins acessarem
CREATE POLICY "Admins can manage notification settings" ON company_notification_settings
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
