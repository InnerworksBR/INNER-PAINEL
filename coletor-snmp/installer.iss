; Inner SNMP Collector - Inno Setup Script
; Cria instalador visual para Windows
; Requer: Inno Setup 6.x (https://jrsoftware.org/isinfo.php)

#define MyAppName "Inner SNMP Collector"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Innerworks"
#define MyAppURL "https://inner.com.br"
#define MyAppExeName "InnerSnmpCollector.exe"

[Setup]
AppId={{D9F8E7C6-B5A4-3E2D-1C0F-9E8D7C6B5A43}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=installer
OutputBaseFilename=InnerSnmpCollector-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=classic
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
MinVersion=10.0

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\start.bat"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start.bat"; Tasks: desktopicon

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Run]
Filename: "{cmd}"; Parameters: "/c sc create InnerSnmpCollector binPath= ""\""{app}\start.bat\"""" start= auto DisplayName= ""Inner SNMP Collector"""; Flags: runhidden; AfterInstall: True
Filename: "{cmd}"; Parameters: "/c sc description InnerSnmpCollector ""Inner SNMP Collector - Monitoramento de Rede"""; Flags: runhidden; AfterInstall: True
Filename: "{cmd}"; Parameters: "/c net start InnerSnmpCollector"; Flags: runhidden; AfterInstall: True

[Code]
var
  PortalPage: TInputQueryWizardPage;
  NetworkPage: TInputQueryWizardPage;
  SnmpPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  PortalPage := CreateInputQueryPage(wpWelcome,
    'Configurar Portal', 'Informe a URL do portal Inner:',
    'O coletor enviara dados para esta URL.');
  PortalPage.Add('URL do Portal:', False);
  PortalPage.Values[0] := 'https://portal.inner.com.br';

  NetworkPage := CreateInputQueryPage(PortalPage.ID,
    'Range de Rede', 'Configure o range de IPs para varredura:',
    'O coletor buscara dispositivos SNMP neste range.');
  NetworkPage.Add('IP Inicial:', False);
  NetworkPage.Values[0] := '192.168.1.1';
  NetworkPage.Add('IP Final:', False);
  NetworkPage.Values[1] := '192.168.1.254';

  SnmpPage := CreateInputQueryPage(NetworkPage.ID,
    'Configuracao SNMP', 'Configure os parametros SNMP:',
    'Community string e a senha de acesso aos dispositivos.');
  SnmpPage.Add('Community String:', True);
  SnmpPage.Values[0] := 'public';
  SnmpPage.Add('Versao SNMP (1 ou 2c):', False);
  SnmpPage.Values[1] := '2c';
end;

function IsValidIP(IP: String): Boolean;
var
  i, Value, Count: Integer;
  Part: String;
begin
  Result := False;
  Count := 0;
  for i := 1 to Length(IP) do
    if IP[i] = '.' then Inc(Count);
  if Count <> 3 then Exit;

  Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = SnmpPage.ID then
  begin
    if Length(SnmpPage.Values[0]) < 1 then
    begin
      MsgBox('Community string e obrigatoria.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: String;
  Ps1Path: String;
  StartBatPath: String;
  ConfigContent: String;
  Ps1Content: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Gerar config.json
    ConfigPath := ExpandConstant('{app}\config.json');
    ConfigContent := '{' + #13#10 +
      '"portalUrl":"' + PortalPage.Values[0] + '",' + #13#10 +
      '"ipRangeStart":"' + NetworkPage.Values[0] + '",' + #13#10 +
      '"ipRangeEnd":"' + NetworkPage.Values[1] + '",' + #13#10 +
      '"communityString":"' + SnmpPage.Values[0] + '",' + #13#10 +
      '"snmpVersion":"' + SnmpPage.Values[1] + '",' + #13#10 +
      '"intervalSeconds":300' + #13#10 +
      '}';
    SaveStringToFile(ConfigPath, ConfigContent, False);

    // Gerar collector.ps1
    Ps1Path := ExpandConstant('{app}\collector.ps1');
    Ps1Content := '# Inner SNMP Collector' + #13#10 +
      '$config = Get-Content "$PSScriptRoot\config.json" | ConvertFrom-Json' + #13#10 +
      'Write-Host "Inner SNMP Collector - Iniciado"' + #13#10 +
      'Write-Host "Portal: $($config.portalUrl)"' + #13#10 +
      'Write-Host "Range: $($config.ipRangeStart) - $($config.ipRangeEnd)"' + #13#10 +
      'while ($true) {' + #13#10 +
      '    Write-Host "Coletando dispositivos SNMP..."' + #13#10 +
      '    Start-Sleep -Seconds $config.intervalSeconds' + #13#10 +
      '}' + #13#10;
    SaveStringToFile(Ps1Path, Ps1Content, False);

    // Gerar start.bat
    StartBatPath := ExpandConstant('{app}\start.bat');
    SaveStringToFile(StartBatPath,
      '@echo off' + #13#10 +
      'cd /d "%~dp0"' + #13#10 +
      'powershell -ExecutionPolicy Bypass -NoLogo -WindowStyle Hidden -File "%~dp0collector.ps1"' + #13#10 +
      'pause' + #13#10, False);
  end;
end;
