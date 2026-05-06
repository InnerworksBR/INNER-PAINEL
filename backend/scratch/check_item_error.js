require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('company_integrations')
      .select('zabbix_api_url, zabbix_user, zabbix_password')
      .eq('company_id', 'e78e1497-0af4-4a3e-9fb1-201a6f7e3cef')
      .single();

  const tokenRes = await axios.post(data.zabbix_api_url, {
      jsonrpc: '2.0', method: 'user.login',
      params: { username: data.zabbix_user, password: data.zabbix_password },
      id: 1, auth: null
  });
  const token = tokenRes.data.result;

  const itemsRes = await axios.post(data.zabbix_api_url, {
      jsonrpc: '2.0', method: 'item.get',
      params: {
          host: 'SRVBCK01',
          search: { key_: 'vm.memory.size[total]' },
          output: ['key_', 'lastvalue', 'lastclock', 'status', 'state', 'error']
      },
      id: 2, auth: token
  });

  console.log("--- ITEM INFO ---");
  console.log(JSON.stringify(itemsRes.data.result, null, 2));
}

run().catch(console.error);
