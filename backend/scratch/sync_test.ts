import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { fetchZabbixMetrics } from '../src/services/zabbix-service';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const companyId = 'e78e1497-0af4-4a3e-9fb1-201a6f7e3cef'; // Carpolog
  console.log(`Iniciando sync para empresa: ${companyId}`);
  
  try {
    const result = await fetchZabbixMetrics(supabase, companyId);
    console.log('Resultado do Sync:', result);
    
    // Verificar no banco
    const { data: servers, error } = await supabase
      .from('servers')
      .select('*')
      .eq('company_id', companyId);
      
    if (error) throw error;
    
    console.log('\n--- DADOS NO BANCO ---');
    servers.forEach(s => {
      console.log(`${s.hostname}: CPU=${s.cpu_usage}% | MEM=${s.memory_usage}% (${s.memory_used}/${s.memory_total} GB) | DISK=${s.disk_usage}% (${s.disk_used}/${s.disk_total} GB) | Status=${s.status}`);
    });
    
  } catch (err: any) {
    console.error('Erro no teste:', err.message);
  }
}

test();
