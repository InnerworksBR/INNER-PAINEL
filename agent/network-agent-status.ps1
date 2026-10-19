#requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$serviceName = 'InnerNetworkAgent'
$statusPath = Join-Path $env:ProgramData 'InnerWorks\NetworkAgent\pairing-status.json'
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
    Write-Output 'Serviço InnerNetworkAgent não está instalado.'
    exit 1
}
Write-Output "Serviço: $($service.Status)"
if (-not (Test-Path -LiteralPath $statusPath)) {
    Write-Output 'Sem estado de vínculo salvo. Verifique se o serviço consegue acessar a API.'
    exit 0
}
$status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
switch ($status.state) {
    'pending' {
        Write-Output "Código de vínculo: $($status.code)"
        Write-Output "Expira em (UTC): $($status.expires_at)"
        Write-Output "Portal: $($status.verification_url)"
    }
    'completed' { Write-Output 'Agente vinculado e ativo.' }
    'relink_required' { Write-Output 'A autorização do agente foi rejeitada. A coleta em cache está pausada; um novo código de vínculo será emitido quando a API estiver acessível.' }
    'waiting_for_internet' { Write-Output 'Aguardando conexão com a API para emitir o código de vínculo.' }
    default { Write-Output "Estado do vínculo: $($status.state)" }
}
