require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function runTest() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase.from('network_devices').select('*');
  console.log("DB DATA SIZE:", data ? data.length : 0);
  console.log("ERROR:", error);
}

runTest();
