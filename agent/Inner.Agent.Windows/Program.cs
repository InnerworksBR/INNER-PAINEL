using Inner.Agent.Windows;
using Inner.Agent.Windows.Collectors;
using Inner.Agent.Windows.Persistence;
using Inner.Agent.Windows.Security;
using Inner.Agent.Windows.Transport;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.AddSingleton<IHostMetricsCollector, WindowsHostMetricsCollector>();
builder.Services.AddSingleton<HyperVCollector>();
builder.Services.AddSingleton<IAgentOutbox>(serviceProvider =>
{
    var options = serviceProvider.GetRequiredService<IOptions<AgentOptions>>().Value;
    return new SqliteAgentOutbox(options.DataDirectory);
});
builder.Services.AddSingleton(serviceProvider =>
{
    var options = serviceProvider.GetRequiredService<IOptions<AgentOptions>>().Value;
    return new DpapiSecretStore(options.DataDirectory);
});
builder.Services.AddHttpClient("agent", client => client.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddSingleton(serviceProvider =>
{
    var options = serviceProvider.GetRequiredService<IOptions<AgentOptions>>().Value;
    var httpClient = serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient("agent");
    return new AgentApiClient(httpClient, options.ApiBaseUrl);
});
builder.Services.AddHostedService<AgentWorker>();
builder.Services.AddWindowsService(options => options.ServiceName = "Inner Hyper-V Agent");

await builder.Build().RunAsync();
