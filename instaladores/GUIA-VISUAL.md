# Instaladores Visuais - Guia Completo

## Visão Geral

Os instaladores visuais usam **Inno Setup** para criar wizards profissionais com interface gráfica.

## Como ficou a instalação visual

### Tela 1: Bem-vindo
```
┌─────────────────────────────────────────────────────────┐
│  ◆ Inner Agent - Setup                        _ □ X │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         Bem-vindo ao Assistente de Instalação           │
│                                                         │
│              do Inner Agent v1.0.0                      │
│                                                         │
│    Este assistente ajudará você a instalar o            │
│    Inner Agent no seu computador.                        │
│                                                         │
│    O Inner Agent coleta métricas de CPU, memória,       │
│    disco e VMs Hyper-V do seu servidor.                 │
│                                                         │
│    [ Continuar > ]                                      │
│                                                         │
│                     < Voltar                             │
└─────────────────────────────────────────────────────────┘
```

### Tela 2: Configurar Portal
```
┌─────────────────────────────────────────────────────────┐
│  ◆ Inner Agent - Setup                        _ □ X │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         Configurar Portal                               │
│                                                         │
│    Informe a URL do portal Inner:                       │
│                                                         │
│    URL do Portal:                                       │
│    ┌─────────────────────────────────────────────────┐  │
│    │ https://portal.inner.com.br                     │  │
│    └─────────────────────────────────────────────────┘  │
│                                                         │
│    Exemplo: https://portal.inner.com.br                │
│                                                         │
│    [ Continuar > ]                                      │
│                                                         │
│                     < Voltar                             │
└─────────────────────────────────────────────────────────┘
```

### Tela 3: Opções
```
┌─────────────────────────────────────────────────────────┐
│  ◆ Inner Agent - Setup                        _ □ X │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         Opções de Instalação                            │
│                                                         │
│    Selecione as opções desejadas:                       │
│                                                         │
│    ☑ Instalar como serviço Windows                      │
│      (Iniciar automaticamente)                         │
│                                                         │
│    ☑ Criar ícone na área de trabalho                  │
│                                                         │
│    ☑ Iniciar automaticamente com o Windows             │
│                                                         │
│    [ Continuar > ]                                      │
│                                                         │
│                     < Voltar                             │
└─────────────────────────────────────────────────────────┘
```

### Tela 4: Instalação (Progresso)
```
┌─────────────────────────────────────────────────────────┐
│  ◆ Inner Agent - Setup                        _ □ X │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         Instalando Inner Agent                          │
│                                                         │
│    Por favor, aguarde enquanto o Inner Agent           │
│    está sendo instalado.                                │
│                                                         │
│    ┌─────────────────────────────────────────────────┐  │
│    │████████████████████░░░░░░░░░░░░░░░░░░░  65%  │  │
│    └─────────────────────────────────────────────────┘  │
│                                                         │
│    Instalando arquivos...                               │
│    Criando serviços...                                   │
│                                                         │
│                     < Cancelar                           │
└─────────────────────────────────────────────────────────┘
```

### Tela 5: Conclusão
```
┌─────────────────────────────────────────────────────────┐
│  ◆ Inner Agent - Setup                        _ □ X │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              Instalação Concluída!                      │
│                                                         │
│    O Inner Agent foi instalado com sucesso.             │
│                                                         │
│    Status do Serviço: ● Em execução                     │
│                                                         │
│    O agente está monitorando:                           │
│      ✓ CPU                                             │
│      ✓ Memória                                         │
│      ✓ Disco                                           │
│      ✓ VMs Hyper-V                                     │
│                                                         │
│    [ Concluir ]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Como Usar

### 1. Instalar Inno Setup

Baixe em: https://jrsoftware.org/isinfo.php

### 2. Compilar os Instaladores

```powershell
# No diretório do projeto
cd C:\Apps\INNER_PAINEL
.\build-installers.ps1
```

### 3. Executar

```
agente\installer\InnerAgent-Setup-1.0.0.exe
coletor-snmp\installer\InnerSnmpCollector-Setup-1.0.0.exe
```

## Para Distribuição

Os instaladores `.exe` podem ser:
- Compartilhados diretamente
- Hospedados para download
- Distribuídos via GPO (Group Policy)
- Instalados via PDQ Deploy, SCCM, Intune

## Scripts Inno Setup

| Arquivo | Descrição |
|---------|-----------|
| `agente/installer.iss` | Script para instalador do Agente |
| `coletor-snmp/installer.iss` | Script para instalador do Coletor |
| `build-installers.ps1` | Script PowerShell para compilar |

## Personalização

### Ícone
Adicione um ícone em `agente/assets/icon.ico` e `coletor-snmp/assets/icon.ico`

### Imagens do Wizard
O Inno Setup usa imagens padrão. Para customizar:
- `WizModernImage-IS.bmp` - Imagem lateral (164x314)
- `WizModernSmallImage-IS.bmp` - Imagem superior (55x55)

### Cores
Edite o arquivo `.iss` para mudar cores e estilos.

## Troubleshooting

### "Inno Setup não encontrado"
```powershell
# Verifique se está instalado
Get-ChildItem "C:\Program Files (x86)\Inno Setup*" -Recurse -Filter "ISCC.exe"
```

### "Compilação falhou"
```powershell
# Execute manualmente para ver o erro
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" agente\installer.iss
```

### "Script .iss inválido"
Abra o arquivo `.iss` no Inno Setup IDE para verificar erros de sintaxe.
