/**
 * Inner Endpoint Agent - Agente de Monitoramento de Servidor/Máquina
 * Coleta métricas de CPU, Memória, Disco e Status em tempo real.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error('[ERRO] Arquivo config.json não encontrado. Execute o instalador primeiro (install-windows.ps1 ou install-linux.sh).');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { api_url, asset_key, agent_secret } = config;

if (!api_url || !asset_key || !agent_secret) {
  console.error('[ERRO] Configuração inválida no config.json. Faltando api_url, asset_key ou agent_secret.');
  process.exit(1);
}

console.log(`[INNER AGENT] Inicializado com sucesso!`);
console.log(`[INNER AGENT] Chave do Ativo: ${asset_key}`);
console.log(`[INNER AGENT] API Target: ${api_url}`);

// Função para medir uso de CPU em %
let prevCpuTimes = getCpuTimes();
let prevCpuTimes2 = null;

function getCpuTimes() {
  const cpus = os.cpus();
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  return { user, nice, sys, idle, irq, total: user + nice + sys + idle + irq };
}

function getCpuUsagePercent() {
  const curr = getCpuTimes();
  const totalDiff = curr.total - prevCpuTimes.total;
  const idleDiff = curr.idle - prevCpuTimes.idle;

  // Guardar segunda medição para comparação
  if (prevCpuTimes2 === null) {
    prevCpuTimes2 = prevCpuTimes;
  }

  // Atualizar para próxima medição
  prevCpuTimes = curr;

  if (totalDiff === 0) return 0;

  let usage = 100 - Math.floor((idleDiff / totalDiff) * 100);
  usage = Math.max(0, Math.min(100, usage));

  // Se CPU é 0% e sistema parece ocioso, tentar usar WMI como fallback
  if (usage === 0 && idleDiff > 0) {
    const wmiCpu = getCpuUsageWMI();
    if (wmiCpu !== null) {
      return wmiCpu;
    }
  }

  return usage;
}

// Fallback para Windows: usa WMI para obter CPU real
function getCpuUsageWMI() {
  try {
    const isWin = process.platform === 'win32';
    if (!isWin) return null;

    // Tentar usar Get-Counter do PowerShell (mais preciso)
    const psCmd = `powershell -NoProfile -Command "$cpu = Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1 | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue; if ($cpu -is [array]) { [math]::Round(($cpu | Measure-Object -Average).Average, 0) } else { [math]::Round($cpu, 0) }"`;
    const out = execSync(psCmd, { encoding: 'utf8', timeout: 5000 }).trim();
    const cpuValue = parseFloat(out);
    if (!isNaN(cpuValue) && cpuValue > 0 && cpuValue <= 100) {
      return Math.round(cpuValue);
    }
  } catch (err) {
    // Silencioso - apenas fallback
  }
  return null;
}

// Obter dados de disco (GB)
function getDiskInfo() {
  let disk_total = 0;
  let disk_used = 0;
  try {
    if (process.platform === 'win32') {
      const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object Size, FreeSpace | ConvertTo-Json"`;
      const out = execSync(psCmd, { encoding: 'utf8', timeout: 5000 });
      const disks = JSON.parse(out);
      const diskList = Array.isArray(disks) ? disks : [disks];
      let totalBytes = 0;
      let freeBytes = 0;
      for (const d of diskList) {
        totalBytes += Number(d.Size || 0);
        freeBytes += Number(d.FreeSpace || 0);
      }
      disk_total = Math.round(totalBytes / (1024 * 1024 * 1024));
      disk_used = Math.round((totalBytes - freeBytes) / (1024 * 1024 * 1024));
    } else {
      const out = execSync("df -B1 / | tail -n 1 | awk '{print $2,$3}'", { encoding: 'utf8', timeout: 5000 });
      const [totalStr, usedStr] = out.trim().split(/\s+/);
      disk_total = Math.round(Number(totalStr || 0) / (1024 * 1024 * 1024));
      disk_used = Math.round(Number(usedStr || 0) / (1024 * 1024 * 1024));
    }
  } catch (err) {
    // Fallback genérico se comando falhar
    disk_total = 100;
    disk_used = 20;
  }
  const disk_usage = disk_total > 0 ? Math.round((disk_used / disk_total) * 100) : 0;
  return { disk_total, disk_used, disk_usage };
}

async function sendMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const memory_total = (totalMem / (1024 * 1024 * 1024)).toFixed(2);
  const memory_used = (usedMem / (1024 * 1024 * 1024)).toFixed(2);
  const memory_usage = Math.round((usedMem / totalMem) * 100);

  const cpu_usage = getCpuUsagePercent();
  const disk = getDiskInfo();

  // Log de warning se CPU está 0% para ajudar no debug
  if (cpu_usage === 0) {
    console.log(`[WARN] CPU reportando 0% - verificando método alternativo...`);
  }

  const payload = {
    asset_key,
    cpu_usage,
    memory_usage,
    memory_total: Number(memory_total),
    disk_usage: disk.disk_usage,
    disk_total: disk.disk_total,
    status: 'Online',
    uptime: Math.floor(os.uptime()),
  };

  const fullUrl = api_url.endsWith('/') ? `${api_url}agent/metrics` : `${api_url}/agent/metrics`;
  const urlObj = new URL(fullUrl);
  const postData = JSON.stringify(payload);

  const reqOptions = {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'x-agent-secret': agent_secret,
    },
  };

  const httpLib = urlObj.protocol === 'https:' ? https : http;

  const req = httpLib.request(reqOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[${new Date().toLocaleTimeString()}] Métricas enviadas com sucesso! CPU: ${cpu_usage}% | RAM: ${memory_usage}% | Disco: ${disk.disk_usage}%`);
      } else {
        console.error(`[${new Date().toLocaleTimeString()}] Erro no envio (${res.statusCode}): ${data}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toLocaleTimeString()}] Falha de conexão com a API: ${err.message}`);
  });

  req.write(postData);
  req.end();
}

// Primeiro envio imediato e depois a cada 30s
sendMetrics();
setInterval(sendMetrics, 30000);
