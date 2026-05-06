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

  const hostsRes = await axios.post(data.zabbix_api_url, {
      jsonrpc: '2.0', method: 'host.get',
      params: {
          filter: { name: 'SRVBCK01' },
          selectItems: ['key_', 'lastvalue', 'name'],
          selectInventory: 'extend',
          output: 'extend'
      },
      id: 2, auth: token
  });

  const host = hostsRes.data.result[0];
  if (!host) {
      console.log("Host SRVBCK01 not found");
      return;
  }

  console.log("--- HOST INFO ---");
  console.log("Name:", host.name);
  console.log("Available:", host.available);
  console.log("Inventory:", JSON.stringify(host.inventory, null, 2));

  console.log("\n--- ALL ITEMS ---");
  host.items.forEach(i => {
      console.log(`${i.key_} [${i.name}] = ${i.lastvalue}`);
  });
}

run().catch(console.error);
