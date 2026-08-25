using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Agent.Windows;

/// <summary>
///     Interface para serviços de heartbeat.
/// </summary>
public interface IHeartbeatService
{
    /// <summary>
    ///     Intervalo de heartbeat em segundos.
    /// </summary>
    int HeartbeatIntervalSeconds { get; }

    /// <summary>
    ///     Envia heartbeat para o servidor.
    /// </summary>
    Task<HeartbeatResponse?> SendHeartbeatAsync(CancellationToken ct);
}
