using System.Security.Cryptography;
using System.Text.Json;

namespace Inner.Monitoring.Application.Updates;

/// <summary>
///     Interface para serviço de atualização assinado.
/// </summary>
public interface ISignedUpdateService
{
    /// <summary>
    ///     Verifica se há atualização disponível.
    /// </summary>
    Task<UpdateCheckResult> CheckForUpdateAsync(string currentVersion, CancellationToken ct);

    /// <summary>
    ///     Baixa e valida um pacote de atualização.
    /// </summary>
    Task<UpdatePackage> DownloadAndValidateAsync(UpdateManifest manifest, CancellationToken ct);

    /// <summary>
    ///     Aplica uma atualização baixada.
    /// </summary>
    Task ApplyUpdateAsync(UpdatePackage package, IProgress<int>? progress = null, CancellationToken ct = default);

    /// <summary>
    ///     Faz rollback para a versão anterior.
    /// </summary>
    Task RollbackAsync(CancellationToken ct);

    /// <summary>
    ///     Obtém histórico de versões instaladas.
    /// </summary>
    Task<IReadOnlyList<InstalledVersion>> GetVersionHistoryAsync(CancellationToken ct);
}

/// <summary>
///     Resultado da verificação de atualização.
/// </summary>
public sealed class UpdateCheckResult
{
    public required bool UpdateAvailable { get; init; }
    public required string CurrentVersion { get; init; }
    public string? LatestVersion { get; init; }
    public UpdateManifest? Manifest { get; init; }
    public string? ReleaseNotes { get; init; }
    public bool IsMandatory { get; init; }
    public DateTime? MandatoryAfter { get; init; }
}

/// <summary>
///     Manifesto de uma atualização.
/// </summary>
public sealed class UpdateManifest
{
    public required string Version { get; init; }
    public required string DownloadUrl { get; init; }
    public required string Sha256Hash { get; init; }
    public required string RsaSignature { get; init; }
    public required string PublicKeyPem { get; init; }
    public required long PackageSizeBytes { get; init; }
    public required string ReleaseNotes { get; init; }
    public required DateTime PublishedAt { get; init; }
    public required DateTime? MandatoryAfter { get; init; }
    public required bool IsDelta { get; init; }
    public string? BaseVersion { get; init; }
    public IReadOnlyDictionary<string, string>? Checksums { get; init; }
}

/// <summary>
///     Pacote de atualização baixado e validado.
/// </summary>
public sealed class UpdatePackage
{
    public required UpdateManifest Manifest { get; init; }
    public required string LocalPath { get; init; }
    public required bool SignatureValid { get; init; }
    public required bool HashValid { get; init; }
    public DateTime DownloadedAt { get; init; }
    public string? AppliedVersion { get; init; }
}

/// <summary>
///     Histórico de versão instalada.
/// </summary>
public sealed class InstalledVersion
{
    public required string Version { get; init; }
    public required DateTime InstalledAt { get; init; }
    public required bool IsCurrent { get; init; }
    public required string InstallPath { get; init; }
    public string? RollbackVersion { get; init; }
}

/// <summary>
///     Tipo de algoritmo de assinatura.
/// </summary>
public enum SignatureAlgorithm
{
    RsaSha256,
    RsaSha384,
    RsaSha512,
    EcdsaSha256
}

/// <summary>
///     Resultado de validação de assinatura.
/// </summary>
public sealed class SignatureValidationResult
{
    public required bool IsValid { get; init; }
    public string? ErrorMessage { get; init; }
    public string? SignerPublicKeyFingerprint { get; init; }
    public DateTime ValidatedAt { get; init; }
}
