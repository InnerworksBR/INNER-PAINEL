using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Contracts.Interfaces;

/// <summary>
///     Provedor de informações de empresa para integração com sistema legado.
/// </summary>
public interface ICompanyProvider
{
    /// <summary>
    ///     Obtém uma empresa pelo ID.
    /// </summary>
    Task<CompanyInfo?> GetCompanyAsync(Guid companyId, CancellationToken cancellationToken = default);

    /// <summary>
    ///     Obtém todas as empresas ativas.
    /// </summary>
    Task<IReadOnlyList<CompanyInfo>> GetActiveCompaniesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    ///     Verifica se uma empresa existe e está ativa.
    /// </summary>
    Task<bool> CompanyExistsAsync(Guid companyId, CancellationToken cancellationToken = default);
}

/// <summary>
///     Informações básicas de uma empresa.
/// </summary>
/// <param name="Id">UUID da empresa.</param>
/// <param name="Name">Nome da empresa.</param>
/// <param name="Status">Status: "active", "disabled".</param>
public sealed record CompanyInfo(
    Guid Id,
    string Name,
    string Status);

/// <summary>
///     Contexto do usuário autenticado.
/// </summary>
/// <param name="UserId">UUID do usuário.</param>
/// <param name="IsPlatformAdmin">Se é administrador da plataforma.</param>
/// <param name="CompanyIds">Empresas que o usuário pode acessar.</param>
/// <param name="Roles">Papéis do usuário.</param>
/// <param name="CorrelationId">ID de correlação da requisição.</param>
public sealed record UserContext(
    Guid UserId,
    bool IsPlatformAdmin,
    IReadOnlySet<Guid> CompanyIds,
    IReadOnlySet<string> Roles,
    string CorrelationId);

/// <summary>
///     Accessor de contexto de usuário.
/// </summary>
public interface IUserContextAccessor
{
    /// <summary>
    ///     Obtém o contexto do usuário atual.
    /// </summary>
    UserContext GetRequiredContext();
}
