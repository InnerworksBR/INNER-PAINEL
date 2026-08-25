namespace Inner.Monitoring.Agent.Windows;

/// <summary>
///     Interface para execução de comandos remotos.
/// </summary>
public interface ICommandExecutor
{
    /// <summary>
    ///     Executa um comando.
    /// </summary>
    Task<CommandResult> ExecuteAsync(AgentCommand command, CancellationToken ct);

    /// <summary>
    ///     Lista de comandos disponíveis.
    /// </summary>
    IReadOnlyList<string> SupportedCommands { get; }
}

/// <summary>
///     Comando para execução.
/// </summary>
public sealed class AgentCommand
{
    public Guid Id { get; set; }
    public required string Type { get; set; }
    public string? Arguments { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
}

/// <summary>
///     Resultado de execução de comando.
/// </summary>
public sealed record CommandResult(
    Guid CommandId,
    string Status,
    DateTimeOffset ExecutedAt,
    string? Output,
    string? Error);
