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
  const groupStats = {};
  
  hosts.forEach(h => {
     (h.groups || []).forEach(g => {
         groupStats[g.name] = (groupStats[g.name] || 0) + 1;
     });
  });

  console.log("--- GRUPOS ENCONTRADOS E QUANTIDADE DE HOSTS ---");
  console.log(groupStats);

}

run().catch(console.error);
