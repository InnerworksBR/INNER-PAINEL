using Inner.Agent.Windows;
using Inner.Agent.Windows.Collectors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.AddSingleton<IHostMetricsCollector, WindowsHostMetricsCollector>();
builder.Services.AddHostedService<AgentWorker>();
builder.Services.AddWindowsService(options => options.ServiceName = "Inner Hyper-V Agent");

await builder.Build().RunAsync();
