[CmdletBinding()]
param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "Inner.Agent.Windows\Inner.Agent.Windows.csproj"
$output = Join-Path $PSScriptRoot "artifacts\publish"
$archive = Join-Path $PSScriptRoot "artifacts\Inner.Agent.Windows-win-x64.zip"

if (Test-Path $output) {
    Remove-Item -LiteralPath $output -Recurse -Force
}
New-Item -ItemType Directory -Path (Split-Path $archive) -Force | Out-Null

$publishArgs = @(
    "publish", $project,
    "--configuration", $Configuration,
    "--runtime", "win-x64",
    "--self-contained", "true",
    "--property:PublishSingleFile=true",
    "--property:IncludeNativeLibrariesForSelfExtract=true",
    "--output", $output
)
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0) { throw "dotnet publish falhou." }

if (Test-Path $archive) {
    Remove-Item -LiteralPath $archive -Force
}
Compress-Archive -Path (Join-Path $output "*") -DestinationPath $archive
Write-Host "Pacote criado em $archive"
