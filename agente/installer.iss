; Inner Agent - Inno Setup Script
; Cria instalador visual para Windows
; Requer: Inno Setup 6.x (https://jrsoftware.org/isinfo.php)

#define MyAppName "Inner Agent"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Innerworks"
#define MyAppURL "https://inner.com.br"
#define MyAppExeName "InnerAgent.exe"

[Setup]
AppId={{E8A7B3C2-4F1D-4E9A-B8C5-6D7E0F1A2B3C}
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
OutputBaseFilename=InnerAgent-Setup-{#MyAppVersion}
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

[Files]
Source: "install\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: InstallFiles

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\start.bat"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start.bat"; Tasks: desktopicon

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Run]
Filename: "{cmd}"; Parameters: "/c sc create InnerAgent binPath= ""\""{app}\start.bat\"""" start= auto DisplayName= ""Inner Agent"""; Flags: runhidden; AfterInstall: True
Filename: "{cmd}"; Parameters: "/c sc description InnerAgent ""Inner Agent - Monitoramento"""; Flags: runhidden; AfterInstall: True
Filename: "{cmd}"; Parameters: "/c net start InnerAgent"; Flags: runhidden; AfterInstall: True

[Code]
var
  PortalUrlPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  PortalUrlPage := CreateInputQueryPage(wpWelcome,
    'Configurar Portal', 'Informe a URL do portal Inner:',
    'O agente enviara metricas para esta URL.');
  PortalUrlPage.Add('URL do Portal:', False);
  PortalUrlPage.Values[0] := 'https://portal.inner.com.br';
end;

function IsValidUrl(Url: String): Boolean;
begin
  Result := (Pos('http://', LowerCase(Url)) = 1) or (Pos('https://', LowerCase(Url)) = 1);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = PortalUrlPage.ID then
  begin
    if not IsValidUrl(PortalUrlPage.Values[0]) then
    begin
      MsgBox('URL do portal invalida. Deve comecar com http:// ou https://', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function InstallFiles: Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: String;
  StartBatPath: String;
  Content: String;
begin
  if CurStep = ssPostInstall then
  begin
    ConfigPath := ExpandConstant('{app}\config.json');
    SaveStringToFile(ConfigPath,
      '{"portalUrl":"' + PortalUrlPage.Values[0] + '","token":"","intervalSeconds":60}' + #13#10,
      False);

    // Criar start.bat
    StartBatPath := ExpandConstant('{app}\start.bat');
    Content := '@echo off' + #13#10 +
      'cd /d "%~dp0"' + #13#10 +
      'powershell -ExecutionPolicy Bypass -NoLogo -WindowStyle Hidden -File "%~dp0agent.ps1"' + #13#10 +
      'pause' + #13#10;
    SaveStringToFile(StartBatPath, Content, False);
  end;
end;
