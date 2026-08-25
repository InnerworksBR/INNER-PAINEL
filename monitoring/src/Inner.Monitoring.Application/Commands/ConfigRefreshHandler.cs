using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Commands;

/// <summary>
///     Handler para comando config_refresh - recarrega configuração.
/// </summary>
public sealed class ConfigRefreshHandler : ICommandHandler
{
    private readonly ILogger<ConfigRefreshHandler> _logger;
    private readonly Func<long> _getCurrentConfigVersion;
    private readonly Func<Task<long>> _refreshConfigAsync;

    public string CommandType => "config_refresh";
    public string Description => "Recarrega configuração do servidor";
    public int DefaultTimeoutSeconds => 30;

    public ConfigRefreshHandler(
        ILogger<ConfigRefreshHandler> logger,
        Func<long> getCurrentConfigVersion,
        Func<Task<long>> refreshConfigAsync)
    {
        _logger = logger;
        _getCurrentConfigVersion = getCurrentConfigVersion;
        _refreshConfigAsync = refreshConfigAsync;
    }

    public async Task<CommandResult> ExecuteAsync(CommandEnvelope envelope, CancellationToken ct)
    {
        var startTime = DateTimeOffset.UtcNow;
        var previousVersion = _getCurrentConfigVersion();

        try
        {
            _logger.LogInformation("Iniciando refresh de configuração. Versão atual: {Version}", previousVersion);

            var newVersion = await _refreshConfigAsync();
            var configChanged = newVersion != previousVersion;

            var duration = DateTimeOffset.UtcNow - startTime;
            var result = new ConfigRefreshResult
            {
                NewConfigVersion = newVersion,
                PreviousConfigVersion = previousVersion,
                ConfigChanged = configChanged,
                RefreshedAt = DateTimeOffset.UtcNow,
                Changes = configChanged
                    ? new Dictionary<string, object> { ["version_delta"] = newVersion - previousVersion }
                    : null
            };

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Succeeded,
                ResultJson = JsonSerializer.Serialize(result),
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = false
            };
        }
        catch (Exception ex)
        {
            var duration = DateTimeOffset.UtcNow - startTime;
            _logger.LogError(ex, "Erro ao recarregar configuração");

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Failed,
                ErrorCode = "CONFIG_REFRESH_ERROR",
                ErrorMessage = ex.Message,
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = true
            };
        }
    }
}
