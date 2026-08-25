# Inner Monitoring - Script de Deploy
# Uso: ./deploy.sh [ambiente] [acao]
# Exemplo: ./deploy.sh production deploy

#!/bin/bash
set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funções de log
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Função de verificação
check_prerequisites() {
    log_info "Verificando pré-requisitos..."

    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado. Instale o Docker primeiro."
        exit 1
    fi

    # Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose não encontrado."
        exit 1
    fi

    # Variáveis de ambiente obrigatórias
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL não está configurada!"
        log_info "Configure a variável DATABASE_URL no arquivo .env.production"
        exit 1
    fi

    if [ -z "$JWT_SECRET_KEY" ]; then
        log_error "JWT_SECRET_KEY não está configurada!"
        log_info "Gere uma chave com: openssl rand -base64 48"
        exit 1
    fi

    log_info "Todos os pré-requisitos OK"
}

# Função de build
build_images() {
    log_info "Construindo imagens Docker..."

    # API
    log_info "Buildando API..."
    docker build \
        -f src/Inner.Monitoring.Cloud.Api/Dockerfile \
        -t inner-monitoring-api:latest \
        -t inner-monitoring-api:$(git rev-parse --short HEAD) \
        .

    # Worker
    log_info "Buildando Worker..."
    docker build \
        -f src/Inner.Monitoring.Cloud.Worker/Dockerfile \
        -t inner-monitoring-worker:latest \
        -t inner-monitoring-worker:$(git rev-parse --short HEAD) \
        .

    log_info "Imagens construídas com sucesso"
}

# Função de deploy
deploy() {
    log_info "Iniciando deploy..."

    # Verificar se o compose file existe
    if [ ! -f "deploy/docker-compose.prod.yml" ]; then
        log_error "docker-compose.prod.yml não encontrado!"
        exit 1
    fi

    # Copiar se necessário
    if [ ! -f "docker-compose.yml" ]; then
        cp deploy/docker-compose.prod.yml docker-compose.yml
    fi

    # Pull imagens (se usar registry)
    log_info "Baixando imagens..."
    docker compose pull || true

    # Build local (sobrescreve pull)
    build_images

    # Parar serviços existentes
    log_info "Parando serviços existentes..."
    docker compose down || true

    # Iniciar API primeiro
    log_info "Iniciando API..."
    docker compose up -d api

    # Aguardar API ficar healthy
    log_info "Aguardando API ficar healthy..."
    for i in {1..30}; do
        if curl -sf http://localhost:5000/health/live > /dev/null 2>&1; then
            log_info "API está healthy!"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "API não ficou healthy após 30 tentativas"
            docker compose logs api
            exit 1
        fi
        sleep 2
    done

    # Iniciar Worker
    log_info "Iniciando Worker..."
    docker compose up -d worker

    log_info "Deploy concluído!"
}

# Função de verificação pós-deploy
verify() {
    log_info "Verificando serviços..."

    echo ""
    echo "=== Status dos Containers ==="
    docker compose ps

    echo ""
    echo "=== Health Checks ==="
    echo -n "API Liveness: "
    curl -sf http://localhost:5000/health/live && echo "OK" || echo "FALHOU"

    echo -n "API Readiness: "
    curl -sf http://localhost:5000/health/ready && echo "OK" || echo "FALHOU"

    echo ""
    echo "=== Logs Recentes (API) ==="
    docker compose logs --tail=10 api

    echo ""
    echo "=== Logs Recentes (Worker) ==="
    docker compose logs --tail=10 worker
}

# Função de rollback
rollback() {
    log_warn "Iniciando rollback..."

    # Obter tags anteriores
    PREVIOUS_API=$(docker images inner-monitoring-api --format "{{.Tag}}" | grep -v latest | head -1)
    PREVIOUS_WORKER=$(docker images inner-monitoring-worker --format "{{.Tag}}" | grep -v latest | head -1)

    if [ -z "$PREVIOUS_API" ]; then
        log_error "Não há versão anterior para rollback"
        exit 1
    fi

    log_info "Rollback para: API=$PREVIOUS_API, Worker=$PREVIOUS_WORKER"

    # Tag como latest
    docker tag inner-monitoring-api:$PREVIOUS_API inner-monitoring-api:latest
    docker tag inner-monitoring-worker:$PREVIOUS_WORKER inner-monitoring-worker:latest

    # Recriar containers
    docker compose up -d --force-recreate

    log_info "Rollback concluído!"
}

# Função de limpeza
cleanup() {
    log_info "Limpando recursos..."

    docker compose down
    docker system prune -f --volumes

    log_info "Limpeza concluída!"
}

# Função de migrations
migrate() {
    log_info "Executando migrations..."

    docker compose run --rm api dotnet ef database update \
        --project src/Inner.Monitoring.Infrastructure.Postgres \
        --no-build \
        --verbose

    log_info "Migrations concluídas!"
}

# Main
AMBIENTE=${1:-production}
ACAO=${2:-deploy}

case $ACAO in
    deploy)
        check_prerequisites
        deploy
        verify
        ;;
    verify)
        verify
        ;;
    rollback)
        rollback
        verify
        ;;
    migrate)
        migrate
        ;;
    cleanup)
        cleanup
        ;;
    build)
        check_prerequisites
        build_images
        ;;
    *)
        echo "Uso: $0 [production] [deploy|verify|rollback|migrate|cleanup|build]"
        echo ""
        echo "Ações:"
        echo "  deploy   - Deploy completo (padrão)"
        echo "  verify   - Verifica status dos serviços"
        echo "  rollback - Rollback para versão anterior"
        echo "  migrate  - Executa migrations"
        echo "  cleanup  - Limpa containers e volumes"
        echo "  build    - Apenas constrói imagens"
        exit 1
        ;;
esac
