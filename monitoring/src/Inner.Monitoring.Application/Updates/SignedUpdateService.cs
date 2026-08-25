using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Updates;

/// <summary>
///     Informações de rollback.
/// </summary>
public sealed class RollbackInfo
{
    public required string Version { get; init; }
    public required DateTime InstalledAt { get; init; }
}

/// <summary>
///     Implementação do serviço de atualização assinado.
/// </summary>
public sealed class SignedUpdateService : ISignedUpdateService
{
    private readonly ILogger<SignedUpdateService> _logger;
    private readonly string _updateBaseUrl;
    private readonly string _currentVersion;
    private readonly string _installPath;
    private readonly string _versionHistoryPath;
    private readonly string _publicKeyPem;
    private readonly HttpClient _httpClient;

    public SignedUpdateService(
        ILogger<SignedUpdateService> logger,
        string updateBaseUrl,
        string currentVersion,
        string installPath,
        string publicKeyPem)
    {
        _logger = logger;
        _updateBaseUrl = updateBaseUrl;
        _currentVersion = currentVersion;
        _installPath = installPath;
        _versionHistoryPath = Path.Combine(installPath, ".versions");
        _publicKeyPem = publicKeyPem;
        _httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };

        // Criar diretório de histórico se não existir
        Directory.CreateDirectory(_versionHistoryPath);
    }

    public async Task<UpdateCheckResult> CheckForUpdateAsync(string currentVersion, CancellationToken ct)
    {
        try
        {
            _logger.LogInformation("Verificando atualização para versão {Version}", currentVersion);

            // Baixar manifesto de atualização
            var manifestUrl = $"{_updateBaseUrl.TrimEnd('/')}/manifest.json";
            var response = await _httpClient.GetStringAsync(manifestUrl, ct);
            var manifest = JsonSerializer.Deserialize<UpdateManifest>(response,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (manifest == null)
            {
                return new UpdateCheckResult
                {
                    UpdateAvailable = false,
                    CurrentVersion = currentVersion
                };
            }

            // Comparar versões
            var updateAvailable = CompareVersions(manifest.Version, currentVersion) > 0;

            // Verificar se atualização é mandatória
            var isMandatory = false;
            DateTime? mandatoryAfter = null;

            if (manifest.MandatoryAfter.HasValue)
            {
                mandatoryAfter = manifest.MandatoryAfter.Value;
                isMandatory = DateTime.UtcNow > mandatoryAfter.Value;
            }

            return new UpdateCheckResult
            {
                UpdateAvailable = updateAvailable,
                CurrentVersion = currentVersion,
                LatestVersion = manifest.Version,
                Manifest = manifest,
                ReleaseNotes = manifest.ReleaseNotes,
                IsMandatory = isMandatory,
                MandatoryAfter = mandatoryAfter
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar atualização");
            return new UpdateCheckResult
            {
                UpdateAvailable = false,
                CurrentVersion = currentVersion
            };
        }
    }

    public async Task<UpdatePackage> DownloadAndValidateAsync(UpdateManifest manifest, CancellationToken ct)
    {
        _logger.LogInformation("Baixando atualização {Version}", manifest.Version);

        var tempPath = Path.Combine(Path.GetTempPath(), $"inner_update_{manifest.Version}_{Guid.NewGuid():N}");
        var packagePath = Path.Combine(tempPath, "package.zip");

        try
        {
            Directory.CreateDirectory(tempPath);

            // Baixar pacote
            using (var response = await _httpClient.GetAsync(manifest.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, ct))
            {
                response.EnsureSuccessStatusCode();

                var totalBytes = response.Content.Headers.ContentLength ?? manifest.PackageSizeBytes;
                var downloadedBytes = 0L;

                await using var contentStream = await response.Content.ReadAsStreamAsync(ct);
                await using var fileStream = new FileStream(packagePath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

                var buffer = new byte[8192];
                int bytesRead;

                while ((bytesRead = await contentStream.ReadAsync(buffer, ct)) > 0)
                {
                    await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead), ct);
                    downloadedBytes += bytesRead;
                }
            }

            // Validar hash
            var hashValid = await ValidateHashAsync(packagePath, manifest.Sha256Hash);

            if (!hashValid)
            {
                throw new InvalidOperationException("Hash do pacote inválido");
            }

            // Validar assinatura
            var signatureValid = await ValidateSignatureAsync(packagePath, manifest.RsaSignature, manifest.PublicKeyPem);

            if (!signatureValid)
            {
                throw new InvalidOperationException("Assinatura do pacote inválida");
            }

            _logger.LogInformation("Pacote {Version} baixado e validado com sucesso", manifest.Version);

            return new UpdatePackage
            {
                Manifest = manifest,
                LocalPath = packagePath,
                SignatureValid = signatureValid,
                HashValid = hashValid,
                DownloadedAt = DateTime.UtcNow
            };
        }
        catch
        {
            // Limpar em caso de erro
            if (Directory.Exists(tempPath))
            {
                Directory.Delete(tempPath, true);
            }
            throw;
        }
    }

    public async Task ApplyUpdateAsync(UpdatePackage package, IProgress<int>? progress = null, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        _logger.LogInformation("Aplicando atualização {Version}", package.Manifest.Version);

        try
        {
            // 1. Registrar versão atual para rollback
            await SaveVersionForRollbackAsync(_currentVersion, ct);

            // 2. Extrair pacote
            var extractPath = Path.Combine(_installPath, $"update_{package.Manifest.Version}");

            progress?.Report(10);
            await ExtractPackageAsync(package.LocalPath, extractPath, ct);
            progress?.Report(40);

            // 3. Validar conteúdo extraído
            await ValidateExtractedContentAsync(extractPath, package.Manifest, ct);
            progress?.Report(60);

            // 4. Substituir arquivos (em produção, usar transação atômica)
            await ReplaceFilesAsync(extractPath, ct);
            progress?.Report(90);

            // 5. Atualizar versão atual
            await UpdateCurrentVersionAsync(package.Manifest.Version, ct);
            progress?.Report(100);

            sw.Stop();
            _logger.LogInformation("Atualização {Version} aplicada com sucesso em {Duration}ms",
                package.Manifest.Version, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Erro ao aplicar atualização {Version}", package.Manifest.Version);

            // Tentar rollback automático
            await RollbackAsync(ct);

            throw;
        }
    }

    public async Task RollbackAsync(CancellationToken ct)
    {
        _logger.LogInformation("Iniciando rollback");

        try
        {
            var rollbackInfo = GetRollbackInfo();
            if (rollbackInfo == null)
            {
                _logger.LogWarning("Nenhuma versão anterior disponível para rollback");
                return;
            }

            var rollbackPath = Path.Combine(_versionHistoryPath, rollbackInfo.Version);

            if (!Directory.Exists(rollbackPath))
            {
                _logger.LogError("Caminho de rollback não encontrado: {Path}", rollbackPath);
                throw new InvalidOperationException("Caminho de rollback não encontrado");
            }

            // Substituir arquivos com a versão anterior
            await ReplaceFilesAsync(rollbackPath, ct);

            // Atualizar versão atual
            await UpdateCurrentVersionAsync(rollbackInfo.Version, ct);

            _logger.LogInformation("Rollback para versão {Version} concluído", rollbackInfo.Version);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao fazer rollback");
            throw;
        }
    }

    public Task<IReadOnlyList<InstalledVersion>> GetVersionHistoryAsync(CancellationToken ct)
    {
        var versions = new List<InstalledVersion>();

        try
        {
            // Versão atual
            versions.Add(new InstalledVersion
            {
                Version = _currentVersion,
                InstalledAt = DateTime.UtcNow,
                IsCurrent = true,
                InstallPath = _installPath
            });

            // Versões anteriores
            if (Directory.Exists(_versionHistoryPath))
            {
                foreach (var dir in Directory.GetDirectories(_versionHistoryPath))
                {
                    var version = Path.GetFileName(dir);
                    var isCurrent = version == _currentVersion;

                    versions.Add(new InstalledVersion
                    {
                        Version = version,
                        InstalledAt = Directory.GetCreationTime(dir),
                        IsCurrent = isCurrent,
                        InstallPath = dir
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao obter histórico de versões");
        }

        return Task.FromResult<IReadOnlyList<InstalledVersion>>(versions);
    }

    private async Task<bool> ValidateHashAsync(string filePath, string expectedHash)
    {
        await using var stream = File.OpenRead(filePath);
        var hashBytes = await SHA256.HashDataAsync(stream, default);
        var actualHash = Convert.ToHexString(hashBytes).ToLowerInvariant();

        return actualHash == expectedHash.ToLowerInvariant();
    }

    private async Task<bool> ValidateSignatureAsync(string filePath, string signatureBase64, string publicKeyPem)
    {
        try
        {
            await using var stream = File.OpenRead(filePath);
            var fileHash = await SHA256.HashDataAsync(stream, default);

            var signature = Convert.FromBase64String(signatureBase64);

            // Parsear chave pública
            using var rsa = RSA.Create();
            rsa.ImportFromPem(publicKeyPem);

            return rsa.VerifyData(fileHash, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao validar assinatura");
            return false;
        }
    }

    private async Task ExtractPackageAsync(string zipPath, string extractPath, CancellationToken ct)
    {
        Directory.CreateDirectory(extractPath);

        await Task.Run(() =>
        {
            System.IO.Compression.ZipFile.ExtractToDirectory(zipPath, extractPath, true);
        }, ct);
    }

    private async Task ValidateExtractedContentAsync(string extractPath, UpdateManifest manifest, CancellationToken ct)
    {
        // Verificar se manifest.json existe e é válido
        var manifestPath = Path.Combine(extractPath, "manifest.json");
        if (!File.Exists(manifestPath))
        {
            throw new InvalidOperationException("manifest.json não encontrado no pacote");
        }

        // Validar checksums dos arquivos
        if (manifest.Checksums != null)
        {
            foreach (var (filePath, expectedChecksum) in manifest.Checksums)
            {
                var fullPath = Path.Combine(extractPath, filePath);
                if (!File.Exists(fullPath))
                {
                    throw new InvalidOperationException($"Arquivo {filePath} não encontrado no pacote");
                }

                await using var stream = File.OpenRead(fullPath);
                var hash = await SHA256.HashDataAsync(stream, default);
                var actualHash = Convert.ToHexString(hash).ToLowerInvariant();

                if (actualHash != expectedChecksum.ToLowerInvariant())
                {
                    throw new InvalidOperationException($"Checksum de {filePath} inválido");
                }
            }
        }
    }

    private async Task ReplaceFilesAsync(string sourcePath, CancellationToken ct)
    {
        // Em produção, implementar substituição atômica
        // 1. Criar diretório temp
        // 2. Copiar novos arquivos
        // 3. Atomicamente mover para o local definitivo

        await Task.Run(() =>
        {
            var files = Directory.GetFiles(sourcePath, "*", SearchOption.AllDirectories);

            foreach (var file in files)
            {
                var relativePath = Path.GetRelativePath(sourcePath, file);
                var destPath = Path.Combine(_installPath, relativePath);
                var destDir = Path.GetDirectoryName(destPath);

                if (!string.IsNullOrEmpty(destDir))
                {
                    Directory.CreateDirectory(destDir);
                }

                File.Copy(file, destPath, true);
            }
        }, ct);
    }

    private async Task SaveVersionForRollbackAsync(string version, CancellationToken ct)
    {
        var backupPath = Path.Combine(_versionHistoryPath, version);

        if (Directory.Exists(backupPath))
        {
            Directory.Delete(backupPath, true);
        }

        Directory.CreateDirectory(backupPath);

        await Task.Run(() =>
        {
            // Copiar arquivos atuais para o backup
            foreach (var file in Directory.GetFiles(_installPath, "*", SearchOption.AllDirectories))
            {
                var relativePath = Path.GetRelativePath(_installPath, file);
                var destPath = Path.Combine(backupPath, relativePath);
                var destDir = Path.GetDirectoryName(destPath);

                if (!string.IsNullOrEmpty(destDir))
                {
                    Directory.CreateDirectory(destDir);
                }

                File.Copy(file, destPath, true);
            }
        }, ct);

        // Salvar metadados
        var metadata = new
        {
            Version = version,
            InstalledAt = DateTime.UtcNow,
            PreviousVersion = GetCurrentVersionFile()
        };

        await File.WriteAllTextAsync(
            Path.Combine(backupPath, "metadata.json"),
            JsonSerializer.Serialize(metadata),
            ct);
    }

    private async Task UpdateCurrentVersionAsync(string version, CancellationToken ct)
    {
        await File.WriteAllTextAsync(
            Path.Combine(_installPath, ".version"),
            version,
            ct);
    }

    private RollbackInfo? GetRollbackInfo()
    {
        var versionFile = Path.Combine(_installPath, ".rollback_version");
        var installedAtFile = Path.Combine(_installPath, ".rollback_installed_at");

        if (!File.Exists(versionFile))
            return null;

        return new RollbackInfo
        {
            Version = File.ReadAllText(versionFile).Trim(),
            InstalledAt = File.Exists(installedAtFile)
                ? DateTime.Parse(File.ReadAllText(installedAtFile).Trim())
                : DateTime.UtcNow
        };
    }

    private string GetCurrentVersionFile()
    {
        var versionFile = Path.Combine(_installPath, ".version");
        return File.Exists(versionFile) ? File.ReadAllText(versionFile) : "unknown";
    }

    private static int CompareVersions(string version1, string version2)
    {
        var v1Parts = version1.Split('.').Select(int.Parse).ToArray();
        var v2Parts = version2.Split('.').Select(int.Parse).ToArray();

        var maxLength = Math.Max(v1Parts.Length, v2Parts.Length);

        for (int i = 0; i < maxLength; i++)
        {
            var v1 = i < v1Parts.Length ? v1Parts[i] : 0;
            var v2 = i < v2Parts.Length ? v2Parts[i] : 0;

            if (v1 > v2) return 1;
            if (v1 < v2) return -1;
        }

        return 0;
    }
}
