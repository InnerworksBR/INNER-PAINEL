namespace Inner.Monitoring.Agent.Windows;

/// <summary>
///     Interface para gerenciamento de configuração.
/// </summary>
public interface IConfigurationService
{
    /// <summary>
    ///     Obtém a configuração atual.
    /// </summary>
    Contracts.Records.SourceConfiguration? CurrentConfiguration { get; }

    /// <summary>
    ///     Versão atual da configuração.
    /// </summary>
    long ConfigVersion { get; }

    /// <summary>
    ///     Busca atualização de configuração do servidor.
    /// </summary>
    Task<(bool Changed, string? ETag)> FetchConfigurationAsync(CancellationToken ct);

    /// <summary>
    ///     Carrega configuração do cache local.
    /// </summary>
    Task LoadFromCacheAsync(CancellationToken ct);

    /// <summary>
    ///     Efetiva a configuração (substitui a atual).
    /// </summary>
    Task ApplyConfigurationAsync(Contracts.Records.SourceConfiguration config, CancellationToken ct);
}
