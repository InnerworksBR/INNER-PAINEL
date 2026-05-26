const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const adminPassword = requireBootstrapPassword('BOOTSTRAP_ADMIN_PASSWORD');
const clientPassword = requireBootstrapPassword('BOOTSTRAP_CLIENT_PASSWORD');

// Use the service role key for the initial bootstrap only.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupDatabase() {
  console.log('Iniciando setup...');

  try {
    console.log('Criando usuario Admin...');
    const { data: adminAuth, error: adminAuthErr } = await supabase.auth.admin.createUser({
      email: 'suporte@innerworks.com.br',
      password: adminPassword,
      email_confirm: true,
    });

    if (adminAuthErr) {
      console.error('Erro ao criar Admin (pode ja existir):', adminAuthErr.message);
    } else {
      console.log('Usuario Admin criado no Auth com ID:', adminAuth.user.id);

      const { error: adminProfileErr } = await supabase
        .from('profiles')
        .upsert({
          id: adminAuth.user.id,
          full_name: 'Administrador Inner',
          role: 'admin',
        });

      if (adminProfileErr) console.error('Erro ao criar perfil de Admin:', adminProfileErr.message);
      else console.log('Perfil de Admin configurado.');
    }

    console.log('\nCriando empresa de teste...');
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert(
        {
          name: 'Carpolog Logistics',
          cnpj: '12.345.678/0001-90',
          sector: 'Logistica',
          status: 'Ativo',
        },
        { onConflict: 'cnpj' }
      )
      .select()
      .single();

    if (companyErr) {
      console.error('Erro ao criar empresa:', companyErr.message);
      return;
    }
    console.log('Empresa criada/encontrada:', company.name, 'ID:', company.id);

    console.log('\nCriando usuario Cliente...');
    const { data: clientAuth, error: clientAuthErr } = await supabase.auth.admin.createUser({
      email: 'cliente@carpolog.com.br',
      password: clientPassword,
      email_confirm: true,
    });

    if (clientAuthErr) {
      console.error('Erro ao criar Cliente (pode ja existir):', clientAuthErr.message);
    } else {
      console.log('Usuario Cliente criado no Auth com ID:', clientAuth.user.id);

      const { error: clientProfileErr } = await supabase
        .from('profiles')
        .upsert({
          id: clientAuth.user.id,
          full_name: 'Gestor Carpolog',
          role: 'client',
          company_id: company.id,
        });

      if (clientProfileErr) console.error('Erro ao criar perfil do Cliente:', clientProfileErr.message);
      else console.log('Perfil de Cliente configurado.');
    }

    console.log('\nSetup concluido!');
  } catch (error) {
    console.error('Erro inesperado:', error);
  }
}

function requireBootstrapPassword(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} precisa ser definida antes de executar create_users.js.`);
  }
  return value;
}

setupDatabase();
