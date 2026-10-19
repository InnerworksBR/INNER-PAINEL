param(
    [string] $InstallerPath = (Join-Path $PSScriptRoot 'InnerNetworkAgent-Setup.exe')
)

$ErrorActionPreference = 'Stop'
$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
if ([IO.Path]::GetFileName($resolvedInstaller) -ne 'InnerNetworkAgent-Setup.exe') {
    throw 'Select the packaged InnerNetworkAgent-Setup.exe.'
}
$process = Start-Process -FilePath $resolvedInstaller -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Installer exited with code $($process.ExitCode)." }
