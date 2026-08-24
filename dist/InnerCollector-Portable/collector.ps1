# Inner SNMP Collector - Descoberta de Dispositivos de Rede
# Versao: 1.0.0

param(
    [string]$PortalUrl = "",
    [string]$CollectorId = "",
    [string]$CollectorSecret = "",
    [int]$IntervalSeconds = 300
)

$ErrorActionPreference = "Continue"
$Script:Version = "1.0.0"
$Script:ConfigFile = "$PSScriptRoot\collector-config.json"
$Script:LogFile = "$PSScriptRoot\collector.log"

# Variaveis globais
$global:CollectorId = $null
$global:CollectorSecret = $null

# Carregar config
if (Test-Path $Script:ConfigFile) {
    $json = Get-Content $Script:ConfigFile -Raw
    $config = $json | ConvertFrom-Json
    if (-not $PortalUrl -and $config.portalUrl) { $PortalUrl = $config.portalUrl }
    if (-not $CollectorId -and $config.collectorId) { $global:CollectorId = $config.collectorId }
    if (-not $CollectorSecret -and $config.collectorSecret) { $global:CollectorSecret = $config.collectorSecret }
    if ($config.intervalSeconds) { $IntervalSeconds = $config.intervalSeconds }
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "$timestamp [$Level] $Message"
    Add-Content -Path $Script:LogFile -Value "$timestamp [$Level] $Message" -ErrorAction SilentlyContinue
}

function Invoke-CollectorRegister {
    Write-Log "Registrando coletor no portal..."

    $hostname = $env:COMPUTERNAME
    $ipAddress = "unknown"

    try {
        $netIP = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1
        if ($netIP) { $ipAddress = $netIP.IPAddress }
    } catch {}

    $body = @{
        activation_token = $CollectorId
        collector_type = "snmp"
        hostname = $hostname
        ip_address = $ipAddress
        os_info = "Windows"
        version = $Script:Version
    }

    try {
        $resp = Invoke-RestMethod -Uri "$PortalUrl/api/collector/enroll" -Method Post -ContentType "application/json" -Body ($body | ConvertTo-Json) -TimeoutSec 30

        if ($resp.status -eq "success") {
            $global:CollectorId = $resp.collector_id
            $global:CollectorSecret = $resp.collector_secret

            # Salvar no config
            $newConfig = @{
                portalUrl = $PortalUrl
                collectorId = $global:CollectorId
                collectorSecret = $global:CollectorSecret
                intervalSeconds = $IntervalSeconds
            }
            $newConfig | ConvertTo-Json | Out-File -FilePath $Script:ConfigFile -Encoding UTF8

            Write-Log "Coletor registrado - ID: $($global:CollectorId)" "SUCCESS"
            return $true
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
        $ping = Test-Connection -ComputerName $IpAddress -Count 1 -Quiet -TimeoutSeconds 2
        return $ping
    } catch {
        return $false
    }
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
        if ($count % 20 -eq 0) {
            Write-Log "Scan progress: $count IPs verificados, $found dispositivos encontrados" "INFO"
        }

        $b1 = [math]::Floor($i / 16777216) % 256
        $b2 = [math]::Floor($i / 65536) % 256
        $b3 = [math]::Floor($i / 256) % 256
        $b4 = $i % 256
        $ip = "$b1.$b2.$b3.$b4"

        # Ping sweep
        $alive = Invoke-IcmpScan -IpAddress $ip

        if ($alive) {
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
                }
            } catch {
                # SNMP nao disponivel, usar apenas ping
            }

            $devices += $device
            $found++
        }
    }

    Write-Log "Scan concluido: $count IPs verificados, $found dispositivos encontrados" "SUCCESS"
    return $devices
}

function Infer-DeviceType {
    param([string]$SysDescr, [string]$DeviceName)

    $combined = "$SysDescr $DeviceName".ToLower()

    if ($combined -match "cisco|catalyst|ios") { return "Switch" }
    if ($combined -match "hp |procurve|aruba") { return "Switch" }
    if ($combined -match "mikrotik|routeros") { return "Router" }
    if ($combined -match "ubiquiti|unifi") { return "Access Point" }
    if ($combined -match "fortinet|fortigate|pfsense") { return "Firewall" }
    if ($combined -match "printer|laserjet|mfc") { return "Printer" }
    if ($combined -match "tp-link|d-link|netgear") { return "Switch" }
    if ($combined -match "dell|powerconnect") { return "Switch" }

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
        Invoke-RestMethod -Uri "$PortalUrl/api/collector/devices" -Method Post -ContentType "application/json" -Headers @{"x-collector-secret" = $global:CollectorSecret} -Body ($body | ConvertTo-Json -Depth 5) -TimeoutSec 60 | Out-Null
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

if (-not $global:CollectorId -or -not $global:CollectorSecret) {
    Write-Log "Coletor nao registrado, tentando registro..." "WARN"
    Invoke-CollectorRegister
}

Write-Log "Coletor inicializado - Intervalo: ${IntervalSeconds}s" "INFO"

# Loop principal
while ($true) {
    # Registrar se necessario
    if (-not $global:CollectorId -or -not $global:CollectorSecret) {
        $ok = Invoke-CollectorRegister
        if (-not $ok) {
            Start-Sleep -Seconds $IntervalSeconds
            continue
        }
    }

    # Buscar configuracao de scan
    try {
        $config = Invoke-RestMethod -Uri "$PortalUrl/api/collector/$global:CollectorId/config" -Method Get -Headers @{"x-collector-secret" = $global:CollectorSecret} -TimeoutSec 30
    } catch {
        Write-Log "Erro ao buscar config: $_" "WARN"
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
