require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function check() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.from('ms365_metrics').select('license_name, total, used').eq('company_id', 'e78e1497-0af4-4a3e-9fb1-201a6f7e3cef');
  console.log(JSON.stringify(data, null, 2));
}
check();
