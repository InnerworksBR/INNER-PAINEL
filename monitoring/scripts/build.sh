#!/bin/bash
# Build e Testes para Inner Monitoring

set -e

echo "=== Inner Monitoring Build Script ==="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Função para print colorido
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar .NET SDK
print_status "Verificando .NET SDK..."
if ! command -v dotnet &> /dev/null; then
    print_error ".NET SDK não encontrado. Instale o .NET 10 SDK."
    exit 1
fi

dotnet_version=$(dotnet --version)
print_status "Usando .NET SDK versão: $dotnet_version"

# Restaurar
print_status "Restaurando dependências..."
dotnet restore

# Build
print_status "Compilando solução..."
dotnet build --no-restore --configuration Release

# Testes
print_status "Executando testes..."
dotnet test --no-build --configuration Release --verbosity normal --collect:"XPlat Code Coverage"

# Verificar resultado dos testes
if [ $? -eq 0 ]; then
    print_status "Todos os testes passaram!"
else
    print_error "Alguns testes falharam."
    exit 1
fi

# Format check
print_status "Verificando formatação..."
dotnet format --verify-no-changes --severity error

print_status "=== Build concluído com sucesso! ==="
