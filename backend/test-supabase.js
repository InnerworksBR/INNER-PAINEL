require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabaseAdmin.from('profiles').upsert({
    id: 'f4c52221-ff27-4a55-8a21-999999999999', // dummy ID that won't exist in auth.users
    full_name: 'Test',
    role: 'client'
  }).select();
  console.log("Upsert ERROR:", error);
}

test();
