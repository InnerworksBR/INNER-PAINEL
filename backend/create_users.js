const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

// Usar a chave de serviço para bypassar o RLS na criação inicial
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupDatabase() {
  console.log('Iniciando setup...');

  try {
    // 1. Tentar criar o usuário Admin
    console.log('Criando usuário Admin...');
    const { data: adminAuth, error: adminAuthErr } = await supabase.auth.admin.createUser({
      email: 'suporte@innerworks.com.br',
      password: 'Inner#@$2026',
      email_confirm: true
    });

    if (adminAuthErr) {
        console.error('Erro ao criar Admin (pode já existir):', adminAuthErr.message);
    } else {
        console.log('Usuário Admin criado no Auth com ID:', adminAuth.user.id);
        
        // Criar o perfil de admin
        const { error: adminProfileErr } = await supabase
          .from('profiles')
          .upsert({ 
              id: adminAuth.user.id, 
              full_name: 'Administrador Inner', 
              role: 'admin' 
          });
        
        if (adminProfileErr) console.error('Erro ao criar perfil de Admin:', adminProfileErr.message);
        else console.log('Perfil de Admin configurado.');
    }

    // 2. Criar uma empresa de teste para o cliente
    console.log('\nCriando empresa de teste...');
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name: 'Carpolog Logistics', cnpj: '12.345.678/0001-90', sector: 'Logística', status: 'Ativo' }, { onConflict: 'cnpj' })
      .select()
      .single();

    if (companyErr) {
        console.error('Erro ao criar empresa:', companyErr.message);
        return; // Interrompe se não conseguir criar empresa
    }
    console.log('Empresa criada/encontrada:', company.name, 'ID:', company.id);

    // 3. Tentar criar o usuário Cliente
    console.log('\nCriando usuário Cliente...');
    const { data: clientAuth, error: clientAuthErr } = await supabase.auth.admin.createUser({
      email: 'cliente@carpolog.com.br',
      password: 'Inner#@$2026',
      email_confirm: true
    });

    if (clientAuthErr) {
        console.error('Erro ao criar Cliente (pode já existir):', clientAuthErr.message);
    } else {
        console.log('Usuário Cliente criado no Auth com ID:', clientAuth.user.id);
        
        // Criar o perfil do cliente associado à empresa
        const { error: clientProfileErr } = await supabase
          .from('profiles')
          .upsert({ 
              id: clientAuth.user.id, 
              full_name: 'Gestor Carpolog', 
              role: 'client',
              company_id: company.id
          });
        
        if (clientProfileErr) console.error('Erro ao criar perfil do Cliente:', clientProfileErr.message);
        else console.log('Perfil de Cliente configurado.');
    }

    console.log('\nSetup concluído!');

  } catch (error) {
    console.error('Erro inesperado:', error);
  }
}

setupDatabase();
