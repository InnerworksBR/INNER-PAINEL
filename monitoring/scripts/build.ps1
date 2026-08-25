# Inner Monitoring Build Script
# Build e Testes para Windows

$ErrorActionPreference = "Stop"

Write-Host "=== Inner Monitoring Build Script ===" -ForegroundColor Cyan
Write-Host ""

# Verificar .NET SDK
Write-Host "[INFO] Verificando .NET SDK..." -ForegroundColor Green
try {
    $dotnetVersion = dotnet --version
    Write-Host "[INFO] Usando .NET SDK versao: $dotnetVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] .NET SDK nao encontrado. Instale o .NET 10 SDK." -ForegroundColor Red
    exit 1
}

# Restaurar
Write-Host "[INFO] Restaurando dependencias..." -ForegroundColor Green
dotnet restore

# Build
Write-Host "[INFO] Compilando solucao..." -ForegroundColor Green
dotnet build --no-restore --configuration Release

# Testes
Write-Host "[INFO] Executando testes..." -ForegroundColor Green
$testResult = dotnet test --no-build --configuration Release --verbosity normal

if ($LASTEXITCODE -eq 0) {
    Write-Host "[INFO] Todos os testes passaram!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Alguns testes falharam." -ForegroundColor Red
    exit 1
}

# Format check
Write-Host "[INFO] Verificando formatacao..." -ForegroundColor Green
dotnet format --verify-no-changes --severity error

Write-Host "[INFO] === Build concluido com sucesso! ===" -ForegroundColor Green
