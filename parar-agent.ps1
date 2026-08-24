Write-Host '=== PARANDO INNER AGENT ===' -ForegroundColor Yellow
Write-Host ''

# 1. Parar servico Windows
Write-Host '[1] Tentando parar servico InnerAgent...' -ForegroundColor Cyan
try {
    Stop-Service -Name 'InnerAgent' -ErrorAction Stop
    Write-Host '    Servico parado com sucesso!' -ForegroundColor Green
} catch {
    Write-Host '    Servico nao esta rodando ou nao existe' -ForegroundColor Gray
}

# 2. Remover servico
Write-Host '[2] Removendo servico InnerAgent...' -ForegroundColor Cyan
try {
    sc.exe delete InnerAgent 2>$null
    Write-Host '    Servico removido!' -ForegroundColor Green
} catch {
    Write-Host '    Nao foi possivel remover' -ForegroundColor Gray
}

# 3. Matar processos PowerShell com agent
Write-Host '[3] Procurando processos agent.ps1...' -ForegroundColor Cyan
Get-Process | Where-Object { $_.ProcessName -like '*powershell*' } | ForEach-Object {
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmd -match 'agent' -or $cmd -match 'Inner') {
            Write-Host "    Matando PID $($_.Id)..." -ForegroundColor Red
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

Write-Host ''
Write-Host '=== VERIFICACAO ===' -ForegroundColor Yellow
Write-Host ''

# Verificar servico
$s = Get-Service -Name 'InnerAgent' -ErrorAction SilentlyContinue
if ($s) {
    Write-Host "Servico InnerAgent: $($s.Status)" -ForegroundColor Red
} else {
    Write-Host 'Servico InnerAgent: NAO EXISTE' -ForegroundColor Green
}

# Verificar processos
$procs = Get-Process | Where-Object { $_.ProcessName -like '*powershell*' }
Write-Host ''
Write-Host "Processos PowerShell ativos: $($procs.Count)" -ForegroundColor Cyan

Write-Host ''
Write-Host '=== SE AINDA ESTIVER RODANDO ===' -ForegroundColor Yellow
Write-Host 'Execute como ADMINISTRADOR:' -ForegroundColor White
Write-Host 'taskkill /F /IM powershell.exe' -ForegroundColor Gray
