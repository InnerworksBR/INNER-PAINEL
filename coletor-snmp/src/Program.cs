using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ColetorSNMP.Models;
using ColetorSNMP.Services;

namespace ColetorSNMP;

class Program
{
    private static IHost? _host;
    private static readonly CancellationTokenSource _cts = new();

    static async Task<int> Main(string[] args)
    {
        Console.WriteLine("===========================================");
        Console.WriteLine("  INNER PAINEL - Coletor SNMP v1.0.0");
        Console.WriteLine("  Descoberta de dispositivos de rede");
        Console.WriteLine("===========================================");
        Console.WriteLine();

        try
        {
            // Configura manipuladores de sinais para graceful shutdown
            SetupSignalHandlers();

            // Constrói o host
            _host = CreateHostBuilder(args).Build();

            // Inicializa os serviços
            using (_host)
            {
                await _host.StartAsync(_cts.Token);

                var logger = _host.Services.GetRequiredService<ILogger<Program>>();
                var config = _host.Services.GetRequiredService<IConfiguration>();
                var apiUrl = config["ApiBaseUrl"] ?? "http://localhost:3000";

                logger.LogInformation("Coletor SNMP iniciado");
                logger.LogInformation("API: {ApiUrl}", apiUrl);
                logger.LogInformation("Pressione Ctrl+C para encerrar...");

                // Obtém o coletor SNMP e inicia o loop de descoberta
                var snmpClient = _host.Services.GetRequiredService<SnmpClient>();
                var maxIps = int.Parse(config["MaxIpsPerScan"] ?? "254");
                var scanInterval = int.Parse(config["ScanIntervalMinutes"] ?? "60");
                var discovery = new Discovery(snmpClient, 10, maxIps,
                    _host.Services.GetRequiredService<ILogger<Discovery>>());

                // Executa descoberta inicial
                await RunDiscoveryAsync(discovery, config, snmpClient, logger);

                // Se configurado como serviço, entra em loop de execução periódica
                if (bool.Parse(config["RunAsService"] ?? "false"))
                {
                    logger.LogInformation("Modo SERVICO ativo - escaneando a cada {Interval} minutos",
                        scanInterval);

                    while (!_cts.Token.IsCancellationRequested)
                    {
                        try
                        {
                            await Task.Delay(TimeSpan.FromMinutes(scanInterval), _cts.Token);
                            await RunDiscoveryAsync(discovery, config, snmpClient, logger);
                        }
                        catch (OperationCanceledException)
                        {
                            break;
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Erro no loop de descoberta");
                        }
                    }
                }
                else
                {
                    // Modo standalone - executa uma vez e sai
                    logger.LogInformation("Modo STANDALONE - execucao unica concluida");
                    Console.WriteLine();
                    Console.WriteLine("Pressione qualquer tecla para sair...");
                    Console.ReadKey();
                }

                logger.LogInformation("Encerrando coletor...");
                await _host.StopAsync(TimeSpan.FromSeconds(10));
            }
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("\nEncerramento solicitado...");
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\nERRO FATAL: {ex.Message}");
            Console.ResetColor();
            return 1;
        }

        Console.WriteLine("Coletor encerrado com sucesso.");
        return 0;
    }

    static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureAppConfiguration((context, config) =>
            {
                config.SetBasePath(Directory.GetCurrentDirectory());
                config.AddJsonFile("config.json", optional: true, reloadOnChange: true);
                config.AddEnvironmentVariables(prefix: "SNMP_");
                config.AddCommandLine(args);
            })
            .ConfigureServices((context, services) =>
            {
                var config = context.Configuration;

                // Configura HttpClient
                services.AddHttpClient<SnmpClient>((sp, client) =>
                {
                    var apiUrl = config["ApiBaseUrl"] ?? "http://localhost:3000";
                    client.BaseAddress = new Uri(apiUrl);
                    client.DefaultRequestHeaders.Add("Accept", "application/json");

                    var apiToken = config["ApiToken"];
                    if (!string.IsNullOrEmpty(apiToken))
                    {
                        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiToken}");
                    }

                    client.Timeout = TimeSpan.FromSeconds(30);
                });

                // Registra configuração
                services.AddSingleton(config);
            })
            .ConfigureLogging((context, logging) =>
            {
                logging.ClearProviders();
                logging.AddConsole();
                logging.SetMinimumLevel(
                    Enum.TryParse<LogLevel>(context.Configuration["Logging:Level"], true, out var level)
                        ? level
                        : LogLevel.Information);
            });

    static async Task RunDiscoveryAsync(
        Discovery discovery,
        IConfiguration config,
        SnmpClient snmpClient,
        ILogger logger)
    {
        Console.WriteLine();
        Console.WriteLine("[{0:HH:mm:ss}] Iniciando descoberta de dispositivos...",
            DateTime.Now);

        var startTime = DateTime.Now;

        // Carrega ranges do config
        var scanRanges = new List<IpRange>();

        config.GetSection("ScanRanges").Bind(scanRanges);

        if (scanRanges.Count == 0)
        {
            // Fallback: usa range do config
            var startIp = config["Discovery:StartIp"];
            var endIp = config["Discovery:EndIp"];

            if (!string.IsNullOrEmpty(startIp) && !string.IsNullOrEmpty(endIp))
            {
                scanRanges.Add(new IpRange
                {
                    Start = startIp,
                    End = endIp,
                    Community = config["Community"] ?? "public"
                });
            }
        }

        if (scanRanges.Count == 0)
        {
            logger.LogWarning("Nenhum range de IP configurado. Adicione ScanRanges ao config.json");
            return;
        }

        var totalDevices = 0;
        var totalSent = 0;

        foreach (var range in scanRanges)
        {
            try
            {
                logger.LogInformation("Escaneando range: {Start} - {End}",
                    range.Start, range.End);

                var devices = await discovery.DiscoverAsync(
                    range.Start,
                    range.End,
                    range.Community,
                    _cts.Token);

                totalDevices += devices.Count;

                foreach (var device in devices)
                {
                    var sent = await snmpClient.SendDeviceToApiAsync(device);
                    if (sent) totalSent++;

                    Console.WriteLine("  [OK] {0,-15} {1,-12} {2,-15} {3}",
                        device.IpAddress,
                        device.DeviceType,
                        device.Manufacturer,
                        device.Hostname);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erro ao escanear range {Start} - {End}",
                    range.Start, range.End);
            }
        }

        var elapsed = DateTime.Now - startTime;
        Console.WriteLine();
        Console.WriteLine("===========================================");
        Console.WriteLine("  RESUMO DA DESCOBERTA");
        Console.WriteLine("===========================================");
        Console.WriteLine("  Duracao:     {0}", elapsed.ToString(@"mm\:ss"));
        Console.WriteLine("  Encontrados: {0} dispositivos", totalDevices);
        Console.WriteLine("  Enviados:    {0} para API", totalSent);
        Console.WriteLine("===========================================");
    }

    static void SetupSignalHandlers()
    {
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            Console.WriteLine("\nSinal de encerramento recebido...");
            _cts.Cancel();
        };

        AppDomain.CurrentDomain.ProcessExit += (sender, e) =>
        {
            Console.WriteLine("Processo finalizando...");
            _cts.Cancel();
        };
    }
}
