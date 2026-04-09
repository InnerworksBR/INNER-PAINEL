import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:\\Apps\\INNER_PAINEL\\backend\\.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const { data, error } = await supabaseAdmin.from('documents').select('id, title, company_id, category, file_url').order('created_at', { ascending: false }).limit(5);
  console.log("Error:", error);
  console.log("Recent Documents:", data);
}

run();
