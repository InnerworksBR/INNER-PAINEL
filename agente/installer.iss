; Inner Agent - Inno Setup Script
; Cria instalador visual para Windows com campo de Token
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
Filename: "{cmd}"; Parameters: "/c sc create InnerAgent binPath= ""\""{app}\start.bat\"""" start= auto DisplayName= ""Inner Agent"""; Flags: runhidden
Filename: "{cmd}"; Parameters: "/c sc description InnerAgent ""Inner Agent - Monitoramento"""; Flags: runhidden
Filename: "{cmd}"; Parameters: "/c net start InnerAgent"; Flags: runhidden

[Code]
var
  PortalPage: TInputQueryWizardPage;
  TokenPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  // Pagina 1: URL do Portal
  PortalPage := CreateInputQueryPage(wpWelcome,
    'Configurar Conexao', 'Informe a URL do portal Inner:',
    'O agente conecara a esta URL para enviar metricas.');
  PortalPage.Add('URL do Portal:', False);
  PortalPage.Values[0] := 'https://portal.inner.com.br';

  // Pagina 2: Token de Ativacao
  TokenPage := CreateInputQueryPage(PortalPage.ID,
    'Token de Ativacao', 'Informe o token de ativacao:',
    'O token foi gerado no painel admin para vincular este agente a uma empresa.');
  TokenPage.Add('Token de Ativacao:', False);
  TokenPage.Values[0] := '';
end;

function IsValidUrl(Url: String): Boolean;
begin
  Result := (Pos('http://', LowerCase(Url)) = 1) or (Pos('https://', LowerCase(Url)) = 1);
end;

function IsValidToken(Token: String): Boolean;
begin
  Result := (Length(Token) >= 10) and (Pos('INNER-KEY-', UpperCase(Token)) = 1);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = PortalPage.ID then
  begin
    if not IsValidUrl(PortalPage.Values[0]) then
    begin
      MsgBox('URL invalida. Deve comecar com http:// ou https://', mbError, MB_OK);
      Result := False;
    end;
  end;
  if CurPageID = TokenPage.ID then
  begin
    if not IsValidToken(TokenPage.Values[0]) then
    begin
      MsgBox('Token invalido. O token deve comecar com INNER-KEY-', mbError, MB_OK);
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
begin
  if CurStep = ssPostInstall then
  begin
    // Gerar config.json com URL e Token
    ConfigPath := ExpandConstant('{app}\config.json');
    SaveStringToFile(ConfigPath,
      '{"portalUrl":"' + PortalPage.Values[0] + '","token":"' + TokenPage.Values[0] + '","intervalSeconds":60}' + #13#10,
      False);

    // Criar start.bat para iniciar o agente
    StartBatPath := ExpandConstant('{app}\start.bat');
    SaveStringToFile(StartBatPath,
      '@echo off' + #13#10 +
      'cd /d "%~dp0"' + #13#10 +
      'powershell -ExecutionPolicy Bypass -NoLogo -WindowStyle Hidden -File "%~dp0agent.ps1"' + #13#10 +
      'pause' + #13#10, False);
  end;
end;
