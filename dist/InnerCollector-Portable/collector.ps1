# Inner SNMP Collector - Descoberta de Dispositivos de Rede
# Versao: 1.0.1

param(
    [string]$PortalUrl = "",
    [string]$ActivationToken = "",
    [int]$IntervalSeconds = 300
)

$ErrorActionPreference = "Continue"
$Script:Version = "1.0.1"
$Script:ConfigFile = "$PSScriptRoot\collector-config.json"
$Script:LogFile = "$PSScriptRoot\collector.log"

# Variaveis globais para credenciais
$global:CollectorId = $null
$global:CollectorSecret = $null

# Carregar config
if (Test-Path $Script:ConfigFile) {
    try {
        $json = Get-Content $Script:ConfigFile -Raw | ConvertFrom-Json
        if (-not $PortalUrl -and $json.portalUrl) { $PortalUrl = $json.portalUrl }
        if (-not $ActivationToken -and $json.activationToken) { $ActivationToken = $json.activationToken }
        if ($json.collectorId) { $global:CollectorId = $json.collectorId }
        if ($json.collectorSecret) { $global:CollectorSecret = $json.collectorSecret }
        if ($json.intervalSeconds) { $IntervalSeconds = $json.intervalSeconds }
    } catch {
        Write-Log "Erro ao carregar config: $_" "WARN"
    }
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "$timestamp [$Level] $Message"
    Add-Content -Path $Script:LogFile -Value "$timestamp [$Level] $Message" -ErrorAction SilentlyContinue
}

function Invoke-CollectorRegister {
    # Se ja tem credenciais, pular
    if ($global:CollectorId -and $global:CollectorSecret) {
        Write-Log "Coletor ja registrado com ID: $($global:CollectorId)" "INFO"
        return $true
    }

    Write-Log "Registrando coletor no portal..."

    $hostname = $env:COMPUTERNAME
    $ipAddress = "unknown"

    try {
        $netIP = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1
        if ($netIP) { $ipAddress = $netIP.IPAddress }
    } catch {}

    $body = @{
        activation_token = $ActivationToken
        collector_type = "snmp"
        hostname = $hostname
        ip_address = $ipAddress
        os_info = "Windows"
        version = $Script:Version
    }

    try {
        $resp = Invoke-RestMethod -Uri "$PortalUrl/api/agent/collector/enroll" -Method Post -ContentType "application/json" -Body ($body | ConvertTo-Json) -TimeoutSec 30

        if ($resp.status -eq "success") {
            $global:CollectorId = $resp.collector_id
            $global:CollectorSecret = $resp.collector_secret

            # Salvar no config
            $newConfig = @{
                portalUrl = $PortalUrl
                activationToken = $ActivationToken
                collectorId = $global:CollectorId
                collectorSecret = $global:CollectorSecret
                intervalSeconds = $IntervalSeconds
            }
            $newConfig | ConvertTo-Json | Out-File -FilePath $Script:ConfigFile -Encoding UTF8

            Write-Log "Coletor registrado - ID: $($global:CollectorId)" "SUCCESS"
            return $true
        } else {
            Write-Log "Registro falhou: $($resp.error)" "ERROR"
        }
    } catch {
        Write-Log "Registro falhou: $_" "ERROR"
    }

    return $false
}

# OID SNMP mais comuns
$SNMP_OIDS = @{
    sysDescr = "1.3.6.1.2.1.1.1.0"
    sysName = "1.3.6.1.2.1.1.5.0"
    sysUpTime = "1.3.6.1.2.1.1.3.0"
    ifNumber = "1.3.6.1.2.1.2.1.0"
    ifDescr = "1.3.6.1.2.1.2.2.1.2"
    ifType = "1.3.6.1.2.1.2.2.1.3"
    ifOperStatus = "1.3.6.1.2.1.2.2.1.8"
}

function Get-SnmpValue {
    param([string]$IpAddress, [string]$Oid, [string]$Community = "public", [int]$Port = 161)

    try {
        # Tentar via SNMP.NET (se disponivel)
        $snmp = New-Object -ComObject SNMPCom
        $result = $snmp.Get("$IpAddress", $Community, $Oid, $Port, 3)
        if ($result) { return $result }
    } catch {}

    return $null
}

function Test-SnmpDevice {
    param([string]$IpAddress, [string]$Community = "public")

    try {
        # Tentar conexao SNMP
        $socket = New-Object System.Net.Sockets.UdpClient($IpAddress, 161)
        $socket.Client.ReceiveTimeout = 2000
        $socket.Client.SendTimeout = 2000

        # Construir pacote SNMP GET
        $pdu = Build-SnmpGetPdu -Community $Community -Oid $SNMP_OIDS.sysDescr
        $socket.Send($pdu, $pdu.Length)

        # Tentar receber resposta
        $endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        $buffer = New-Object byte[] 1024
        $data = $socket.Receive([ref]$endpoint)

        $socket.Close()

        if ($data -and $data.Length -gt 0) {
            return $true
        }
    } catch {
        # Tentar ping como fallback
        $ping = Test-Connection -ComputerName $IpAddress -Count 1 -Quiet -ErrorAction SilentlyContinue
        if ($ping) {
            return $true
        }
    }

    return $false
}

function Build-SnmpGetPdu {
    param([string]$Community, [string]$Oid)

    # Versao SNMP v2c (0 = v1, 1 = v2c)
    $version = 1
    $communityBytes = [System.Text.Encoding]::ASCII.GetBytes($Community)

    # Construir PDU SNMP
    $pdu = @()

    # Sequence
    $pdu += 0x30

    # Message sequence (simplificado)
    $msgSeq = @()
    $msgSeq += 0x02, 0x01, $version  # Version
    $msgSeq += 0x04  # OctetString tag
    $msgSeq += $communityBytes.Length
    $msgSeq += $communityBytes

    # PDU
    $pdu += 0x30
    $pdu += $msgSeq.Length
    $pdu += $msgSeq

    return [byte[]]$pdu
}

function Invoke-IcmpScan {
    param([string]$IpAddress)

    try {
        $ping = Test-Connection -ComputerName $IpAddress -Count 1 -Quiet -TimeoutSeconds 1
        return $ping
    } catch {
        return $false
    }
}

function Test-Port {
    param([string]$IpAddress, [int]$Port = 161)

    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $result = $tcp.BeginConnect($IpAddress, $Port, $null, $null)
        $wait = $result.AsyncWaitHandle.WaitOne(500, $false)
        if ($wait) {
            try {
                $tcp.EndConnect($result)
                $tcp.Close()
                return $true
            } catch {
                $tcp.Close()
            }
        }
        $tcp.Close()
    } catch {}

    # Tentar porta 80/443 mesmo se 161 falhar
    if ($Port -eq 161) {
        return (Test-Port -IpAddress $IpAddress -Port 80) -or (Test-Port -IpAddress $IpAddress -Port 443)
    }

    return $false
}

function Get-NetworkDevices {
    param([string]$StartIp, [string]$EndIp, [string]$Community = "public")

    Write-Log "Iniciando scan de rede: $StartIp - $EndIp" "INFO"

    $devices = @()
    $start = [System.Net.IPAddress]::Parse($StartIp).GetAddressBytes()
    $startNum = ($start[0] * 16777216) + ($start[1] * 65536) + ($start[2] * 256) + $start[3]

    $end = [System.Net.IPAddress]::Parse($EndIp).GetAddressBytes()
    $endNum = ($end[0] * 16777216) + ($end[1] * 65536) + ($end[2] * 256) + $end[3]

    $count = 0
    $found = 0

    for ($i = $startNum; $i -le $endNum; $i++) {
        $count++
        if ($count % 10 -eq 0) {
            Write-Log "Scan progress: $count IPs verificados, $found dispositivos encontrados" "INFO"
        }

        $b1 = [math]::Floor($i / 16777216) % 256
        $b2 = [math]::Floor($i / 65536) % 256
        $b3 = [math]::Floor($i / 256) % 256
        $b4 = $i % 256
        $ip = "$b1.$b2.$b3.$b4"

        # Tentar varias portas comuns de dispositivos de rede
        $ports = @(161, 80, 443, 22, 23, 161, 162, 8080, 8443)
        $detected = $false

        foreach ($port in $ports) {
            if (Test-Port -IpAddress $ip -Port $port) {
                $detected = $true
                break
            }
        }

        if ($detected) {
            Write-Log "Dispositivo encontrado: $ip" "INFO"

            $device = @{
                ip_address = $ip
                device_name = "Device-$ip"
                device_type = "Unknown"
                status = "Online"
                uptime = 0
                sysdescr = ""
                community = $Community
            }

            # Tentar coletar mais informacoes via SNMP
            try {
                # Usar snmpwalk.exe se disponivel
                $snmpwalkPath = "$PSScriptRoot\snmpwalk.exe"
                if (Test-Path $snmpwalkPath) {
                    # Coletar sysDescr
                    $output = & $snmpwalkPath -v 2c -c $Community $ip "1.3.6.1.2.1.1.1.0" 2>$null
                    if ($output -match "STRING:\s*""(.+)""") {
                        $device.sysdescr = $matches[1]
                    }

                    # Coletar sysName
                    $output = & $snmpwalkPath -v 2c -c $Community $ip "1.3.6.1.2.1.1.5.0" 2>$null
                    if ($output -match "STRING:\s*""(.+)""") {
                        $device.device_name = $matches[1]
                    }

                    # Coletar uptime
                    $output = & $snmpwalkPath -v 2c -c $Community $ip "1.3.6.1.2.1.1.3.0" 2>$null
                    if ($output -match "Timeticks:\s*(\d+)") {
                        $device.uptime = [int]$matches[1]
                    }

                    # Inferir tipo
                    $device.device_type = Infer-DeviceType -SysDescr $device.sysdescr -DeviceName $device.device_name
                } else {
                    # Sem snmpwalk, inferir tipo pela porta aberta
                    $device.device_type = Infer-DeviceTypeByPort -IpAddress $ip
                }
            } catch {
                # SNMP nao disponivel, usar apenas ping
                $device.device_type = Infer-DeviceTypeByPort -IpAddress $ip
            }

            $devices += $device
            $found++
        }
    }

    Write-Log "Scan concluido: $count IPs verificados, $found dispositivos encontrados" "SUCCESS"
    return $devices
}

function Infer-DeviceTypeByPort {
    param([string]$IpAddress)

    # Tentar detectar pelo comportamento/tipo de dispositivo
    # Isso e uma heuristica
    try {
        # Tentar HTTP para ver se e um dispositivo web
        $response = Invoke-WebRequest -Uri "http://$IpAddress" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response) {
            $content = $response.Content.ToLower()
            if ($content -match "cisco|switch|router") { return "Switch" }
            if ($content -match "mikrotik|routeros") { return "Router" }
            if ($content -match "printer|laserjet|impressora") { return "Printer" }
            if ($content -match "ubiquiti|unifi|access") { return "Access Point" }
            if ($content -match "fortinet|fortigate") { return "Firewall" }
        }
    } catch {}

    # Tentar detectar por resposta SNMP generica
    $snmpwalkPath = "$PSScriptRoot\snmpwalk.exe"
    if (Test-Path $snmpwalkPath) {
        $output = & $snmpwalkPath -v 2c -c "public" $IpAddress "1.3.6.1.2.1.1.1.0" 2>$null
        if ($output -and $output -notmatch "Timeout") {
            return Infer-DeviceType -SysDescr $output -DeviceName ""
        }
    }

    return "Network Device"
}

function Infer-DeviceType {
    param([string]$SysDescr, [string]$DeviceName)

    $combined = "$SysDescr $DeviceName".ToLower()

    if ($combined -match "cisco|catalyst|ios|2960|3750|9300|9500") { return "Switch" }
    if ($combined -match "hp |procurve|aruba|j9772|j4865") { return "Switch" }
    if ($combined -match "mikrotik|routeros|routerboard|rb|CCR") { return "Router" }
    if ($combined -match "ubiquiti|unifi|aircube|usg|udm|switch") { return "Access Point" }
    if ($combined -match "fortinet|fortigate|fortiswitch") { return "Firewall" }
    if ($combined -match "printer|laserjet|mfc|impressora|dcp-l|samsung hp|brother") { return "Printer" }
    if ($combined -match "tp-link|d-link|netgear|gs|sg|switch") { return "Switch" }
    if ($combined -match "dell|powerconnect|n-series|n1548") { return "Switch" }
    if ($combined -match "zte|huawei|ont|gpon|olt") { return "ONT/ONU" }
    if ($combined -match "intelbras|ipcommerce|seud") { return "Access Point" }
    if ($combined -match "axiros|acs|cpe|tr-069") { return "CPE" }

    return "Network Device"
}

function Send-CollectorData {
    param($Devices)

    if (-not $global:CollectorId -or -not $global:CollectorSecret) {
        return $false
    }

    $body = @{
        collector_id = $global:CollectorId
        idempotency_key = [guid]::NewGuid().ToString()
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        devices = $Devices
    }

    try {
        Invoke-RestMethod -Uri "$PortalUrl/api/agent/collector/devices" -Method Post -ContentType "application/json" -Headers @{"x-collector-secret" = $global:CollectorSecret} -Body ($body | ConvertTo-Json -Depth 5) -TimeoutSec 60 | Out-Null
        return $true
    } catch {
        Write-Log "Erro ao enviar dados: $_" "ERROR"
        return $false
    }
}

# ============================================
# MAIN
# ============================================

Write-Log "========================================" "INFO"
Write-Log "Inner SNMP Collector v$Script:Version" "INFO"
Write-Log "========================================" "INFO"

if (-not $PortalUrl) {
    Write-Log "ERRO: Configure portalUrl no collector-config.json" "ERROR"
    exit 1
}

if (-not $ActivationToken -and (-not $global:CollectorId -or -not $global:CollectorSecret)) {
    Write-Log "ERRO: Configure activationToken no collector-config.json" "ERROR"
    exit 1
}

# Tentar registro se nao tem credenciais
if (-not $global:CollectorId -or -not $global:CollectorSecret) {
    Write-Log "Coletor nao registrado, tentando registro..." "WARN"
    $registered = Invoke-CollectorRegister
    if (-not $registered) {
        Write-Log "Falha no registro. Verifique o token e a URL do portal." "ERROR"
    }
}

Write-Log "Coletor inicializado - Intervalo: ${IntervalSeconds}s" "INFO"

# Loop principal
while ($true) {
    # Verificar se precisa registrar
    if (-not $global:CollectorId -or -not $global:CollectorSecret) {
        Write-Log "Tentando registro novamente..." "WARN"
        $ok = Invoke-CollectorRegister
        if (-not $ok) {
            Start-Sleep -Seconds $IntervalSeconds
            continue
        }
    }

    # Buscar configuracao de scan
    try {
        $config = Invoke-RestMethod -Uri "$PortalUrl/api/agent/collector/$global:CollectorId/config" -Method Get -Headers @{"x-collector-secret" = $global:CollectorSecret} -TimeoutSec 30
    } catch {
        Write-Log "Erro ao buscar config: $_" "WARN"
        # Se falhar, pode ser que as credenciais estao erradas - tentar registro de novo
        $global:CollectorId = $null
        $global:CollectorSecret = $null
        Start-Sleep -Seconds $IntervalSeconds
        continue
    }

    if ($config.enabled) {
        Write-Log "Iniciando coleta SNMP..." "INFO"

        $devices = Get-NetworkDevices -StartIp $config.ip_range_start -EndIp $config.ip_range_end -Community $config.community_string

        if ($devices.Count -gt 0) {
            $sent = Send-CollectorData -Devices $devices
            if ($sent) {
                Write-Log "$($devices.Count) dispositivos enviados com sucesso" "SUCCESS"
            }
        } else {
            Write-Log "Nenhum dispositivo encontrado" "INFO"
        }
    } else {
        Write-Log "Coletor desabilitado no portal" "INFO"
    }

    Start-Sleep -Seconds $IntervalSeconds
}
