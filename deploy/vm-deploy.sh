#!/bin/bash
# deploy/vm-deploy.sh
# Run on each VM to pull & start services
# Usage: ./deploy/vm-deploy.sh <dockerhub-username> [version] <service>

set -e

DOCKER_USER="${1:?Usage: $0 <dockerhub-username> [version] <service>}"
VERSION="${2:-latest}"
SERVICE="${3:?Usage: $0 <username> [version] <db|blockchain|backend|frontend|all>}"
REGISTRY="docker.io/${DOCKER_USER}"

cd "$(dirname "$0")/.."

echo ""
echo "📥 Pulling images from ${REGISTRY} (tag: ${VERSION})"
echo ""

pull_service() {
    local img="$1"
    echo "   pulling ${REGISTRY}/${img}:${VERSION}..."
    docker pull "${REGISTRY}/${img}:${VERSION}"
    docker tag "${REGISTRY}/${img}:${VERSION}" "${img}:${VERSION}"
}

case "${SERVICE}" in
    db)
        pull_service "nida-database"
        docker compose -f docker-compose.yml up -d db pgadmin prisma
        ;;
    blockchain)
        pull_service "nida-blockchain"
        docker compose -f docker-compose.yml up -d blockchain
        ;;
    backend)
        pull_service "nida-backend"
        docker compose -f docker-compose.yml up -d backend
        ;;
    frontend)
        pull_service "nida-frontend"
        docker compose -f docker-compose.yml up -d frontend
        ;;
    fullnode)
        pull_service "nida-database"
        pull_service "nida-blockchain"
        pull_service "nida-backend"
        COMPOSE_PROFILES=fullnode docker compose -f docker-compose.yml up -d
        ;;
    all)
        pull_service "nida-database"
        pull_service "nida-blockchain"
        pull_service "nida-backend"
        pull_service "nida-frontend"
        docker compose -f docker-compose.yml up -d
        ;;
    *)
        echo "Unknown service: ${SERVICE}"
        echo "Use: db | blockchain | backend | frontend | fullnode | all"
        exit 1
        ;;
esac

echo ""
echo "✅ ${SERVICE} deployed!"
echo "   docker compose ps"
docker compose ps
