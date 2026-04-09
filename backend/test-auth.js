require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const email = `test_rls_violation_${Date.now()}@test.com`;
  console.log("Creating user");
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true
  });
  
  if (authError) {
    console.log("Auth Error: ", authError);
    return;
  }
  
  const userId = authData?.user?.id;
  
  if (userId) {
      console.log('User created:', userId);
      // Intentionalmente usando company_id: '' para ver se ele retorna RLS violation em vez de uuid syntax error
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: userId, full_name: 'Test', role: 'admin', company_id: '', updated_at: new Date() })
        .select();
        
      console.log("Profiles Upsert Error: ", error);
  }
}

test();
