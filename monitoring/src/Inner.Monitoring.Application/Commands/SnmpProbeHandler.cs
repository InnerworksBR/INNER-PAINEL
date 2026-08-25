using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Commands;

/// <summary>
///     Handler para comando snmp_probe - probe SNMP ad-hoc.
/// </summary>
public sealed class SnmpProbeHandler : ICommandHandler
{
    private readonly ILogger<SnmpProbeHandler> _logger;

    public string CommandType => "snmp_probe";
    public string Description => "Executa probe SNMP em um dispositivo";
    public int DefaultTimeoutSeconds => 30;

    public SnmpProbeHandler(ILogger<SnmpProbeHandler> logger)
    {
        _logger = logger;
    }

    public async Task<CommandResult> ExecuteAsync(CommandEnvelope envelope, CancellationToken ct)
    {
        var startTime = DateTimeOffset.UtcNow;

        try
        {
            // Extrair parâmetros
            var targetIp = envelope.Parameters?.GetValueOrDefault("target_ip")?.ToString()
                ?? throw new ArgumentException("Parâmetro target_ip é obrigatório");
            var targetPort = envelope.Parameters?.GetValueOrDefault("target_port") is int port
                ? port : 161;
            var snmpVersion = envelope.Parameters?.GetValueOrDefault("snmp_version")?.ToString() ?? "v2c";

            _logger.LogInformation("Executando SNMP probe para {TargetIp}:{Port}", targetIp, targetPort);

            // Simular probe SNMP
            // Em produção, usaria SharpSnmpLib para fazer o probe real
            var probeResult = await PerformSnmpProbeAsync(targetIp, targetPort, snmpVersion, ct);

            var duration = DateTimeOffset.UtcNow - startTime;

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = probeResult.Status == ProbeStatus.Success
                    ? CommandStatus.Succeeded
                    : CommandStatus.Failed,
                ResultJson = JsonSerializer.Serialize(probeResult),
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = probeResult.Status == ProbeStatus.Timeout,
                ErrorCode = probeResult.Status != ProbeStatus.Success ? probeResult.Status.ToString() : null,
                ErrorMessage = probeResult.ErrorMessage
            };
        }
        catch (Exception ex)
        {
            var duration = DateTimeOffset.UtcNow - startTime;
            _logger.LogError(ex, "Erro ao executar SNMP probe");

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Failed,
                ErrorCode = "SNMP_PROBE_ERROR",
                ErrorMessage = ex.Message,
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = true
            };
        }
    }

    private async Task<SnmpProbeResult> PerformSnmpProbeAsync(
        string targetIp,
        int targetPort,
        string snmpVersion,
        CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        try
        {
            // Criar socket UDP para testar conectividade SNMP
            using var udpClient = new System.Net.Sockets.UdpClient();

            // Timeout para o probe
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            // Tentar conectar
            var endpoint = new System.Net.IPEndPoint(System.Net.IPAddress.Parse(targetIp), targetPort);

            // Enviar pacote SNMP v2c GET request (simulado com dados básicos)
            // Em produção, usaria SharpSnmpLib para construir o pacote real
            var snmpPacket = BuildSnmpGetRequest(snmpVersion);

            await udpClient.SendAsync(snmpPacket, snmpPacket.Length, endpoint);

            // Aguardar resposta com timeout
            var receiveTask = udpClient.ReceiveAsync();
            var completedTask = await Task.WhenAny(receiveTask, Task.Delay(5000, cts.Token));

            if (completedTask == receiveTask && !receiveTask.IsFaulted)
            {
                var response = await receiveTask;
                sw.Stop();

                // Parsear resposta SNMP
                // Em produção, decodificaria a resposta real
                return new SnmpProbeResult
                {
                    TargetIp = targetIp,
                    TargetPort = targetPort,
                    Status = ProbeStatus.Success,
                    ResponseTime = sw.Elapsed,
                    SnmpVersion = snmpVersion,
                    SystemDescription = "SNMP Device",
                    SystemOid = "1.3.6.1.2.1.1.1.0",
                    Variables = new Dictionary<string, string>
                    {
                        ["sysDescr.0"] = "SNMP Device Response Received",
                        ["sysUpTime.0"] = $"{sw.ElapsedMilliseconds * 10} ticks"
                    }
                };
            }
            else
            {
                sw.Stop();

                // Timeout - mas o host respondeu, problema de SNMP
                return new SnmpProbeResult
                {
                    TargetIp = targetIp,
                    TargetPort = targetPort,
                    Status = ProbeStatus.Timeout,
                    ResponseTime = sw.Elapsed,
                    ErrorMessage = "Timeout aguardando resposta SNMP"
                };
            }
        }
        catch (System.Net.Sockets.SocketException ex) when (ex.SocketErrorCode == System.Net.Sockets.SocketError.ConnectionRefused)
        {
            sw.Stop();
            return new SnmpProbeResult
            {
                TargetIp = targetIp,
                TargetPort = targetPort,
                Status = ProbeStatus.NetworkError,
                ResponseTime = sw.Elapsed,
                ErrorMessage = "Host inacessível ou SNMP não configurado"
            };
        }
        catch (System.Net.Sockets.SocketException ex) when (ex.SocketErrorCode == System.Net.Sockets.SocketError.TimedOut)
        {
            sw.Stop();
            return new SnmpProbeResult
            {
                TargetIp = targetIp,
                TargetPort = targetPort,
                Status = ProbeStatus.Timeout,
                ResponseTime = sw.Elapsed,
                ErrorMessage = "Timeout de rede"
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new SnmpProbeResult
            {
                TargetIp = targetIp,
                TargetPort = targetPort,
                Status = ProbeStatus.NetworkError,
                ResponseTime = sw.Elapsed,
                ErrorMessage = ex.Message
            };
        }
    }

    private static byte[] BuildSnmpGetRequest(string version)
    {
        // Construir um pacote SNMP GET request básico
        // Para v2c: community = "public"
        // Em produção, usaria SharpSnmpLib para construir corretamente

        using var ms = new System.IO.MemoryStream();
        using var bw = new System.IO.BinaryWriter(ms);

        // SNMP v2c GET request (simplificado)
        // Sequence
        bw.Write((byte)0x30);

        // Placeholder para comprimento - corrigido depois
        var lengthPos = ms.Position;
        bw.Write((byte)0x00);

        // Version (v2c = 1)
        bw.Write((byte)0x02);
        bw.Write((byte)0x01);
        bw.Write((byte)0x01);

        // Community
        bw.Write((byte)0x04);
        bw.Write((byte)0x06);
        var community = System.Text.Encoding.ASCII.GetBytes("public");
        bw.Write(community);

        // PDU Type (GetRequest = 0xA0)
        bw.Write((byte)0xA0);

        // Request ID
        bw.Write((byte)0x02);
        bw.Write((byte)0x04);
        bw.Write(BitConverter.GetBytes(Environment.TickCount));

        // OID para sysDescr.0
        bw.Write((byte)0x30);
        bw.Write((byte)0x0E);
        bw.Write(new byte[] { 0x06, 0x08, 0x2B, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00 });

        // Null value
        bw.Write((byte)0x05);
        bw.Write((byte)0x00);

        // Corrigir comprimento
        var totalLength = (int)(ms.Position - 1);
        ms.Position = lengthPos;
        bw.Write((byte)totalLength);

        return ms.ToArray();
    }
}
