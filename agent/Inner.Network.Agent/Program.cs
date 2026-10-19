using Inner.Network.Agent.Workers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = "InnerNetworkAgent");
builder.Services.AddHostedService<NetworkAgentWorker>();
await builder.Build().RunAsync();
