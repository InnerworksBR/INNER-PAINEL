require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize supabase using backend env
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Buscando credenciais da carpolog...");
  const { data, error } = await supabase.from('company_integrations')
      .select('zabbix_api_url, zabbix_user, zabbix_password')
      .eq('company_id', 'e78e1497-0af4-4a3e-9fb1-201a6f7e3cef')
      .single();

  if (error || !data) {
      console.log("Erro ao buscar credenciais", error);
      return;
  }

  console.log("Logando no Zabbix:", data.zabbix_api_url);
  const tokenRes = await axios.post(data.zabbix_api_url, {
      jsonrpc: '2.0',
      method: 'user.login',
      params: { username: data.zabbix_user, password: data.zabbix_password },
      id: 1,
      auth: null
  });

  if (tokenRes.data.error) {
      console.log("Zabbix Auth Error:", tokenRes.data.error);
      return;
  }
  
  const token = tokenRes.data.result;
  console.log("Auth token obtido.");

  const hostsRes = await axios.post(data.zabbix_api_url, {
      jsonrpc: '2.0',
      method: 'host.get',
      params: {
          selectGroups: ['name'],
          selectItems: ['key_', 'lastvalue'],
          output: ['host', 'name']
      },
      id: 2,
      auth: token
  });

  if (hostsRes.data.error) {
      console.log("Zabbix host.get Error:", hostsRes.data.error);
      return;
  }

  const hosts = hostsRes.data.result || [];
  
  const targetHosts = hosts.filter(h => h.name === 'SRVBCK01' || h.name === 'Zabbix server' || h.name === 'SRVDB01');
  if (targetHosts.length > 0) {
      targetHosts.forEach(targetHost => {
          if (targetHost.items) {
              console.log(`\nItems for ${targetHost.name}:`);
              targetHost.items.forEach(i => {
                  if (i.key_.includes('vfs.fs') || i.key_.includes('memory') || i.key_.includes('cpu') || i.key_.includes('swap') || i.key_.includes('uptime') || i.key_.includes('os') || i.key_.includes('uname')) {
                      console.log(`${i.key_} = ${i.lastvalue}`);
                  }
              });
          }
      });
  } else {
      console.log("Host not found or no items.");
  }
}

run().catch(console.error);
