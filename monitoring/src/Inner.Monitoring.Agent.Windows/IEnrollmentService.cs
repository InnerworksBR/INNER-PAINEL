using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Agent.Windows;

/// <summary>
///     Interface para gerenciamento de enrollment.
/// </summary>
public interface IEnrollmentService
{
    /// <summary>
    ///     Verifica se o agente está registrado.
    /// </summary>
    bool IsEnrolled { get; }

    /// <summary>
    ///     Obtém o ID da fonte registrada.
    /// </summary>
    Guid? SourceId { get; }

    /// <summary>
    ///     Realiza o enrollment inicial com token de ativação.
    /// </summary>
    Task<SourceRegistrationResponse> EnrollAsync(string activationToken, CancellationToken ct);

    /// <summary>
    ///     Atualiza o enrollment existente (renova tokens).
    /// </summary>
    Task<TokenRefreshResponse> RefreshTokensAsync(CancellationToken ct);

    /// <summary>
    ///     Obtém os endpoints configurados.
    /// </summary>
    SourceEndpoints? Endpoints { get; }

    /// <summary>
    ///     Obtém o access token atual.
    /// </summary>
    string? AccessToken { get; }

    /// <summary>
    ///     Garante que o token é válido.
    /// </summary>
    Task<bool> EnsureValidTokenAsync(CancellationToken ct);

    /// <summary>
    ///     Limpa enrollment.
    /// </summary>
    void ClearEnrollment();
}
