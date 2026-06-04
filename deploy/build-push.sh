#!/bin/bash
# deploy/build-push.sh
# Build & push Docker images to Docker Hub
# Usage: ./deploy/build-push.sh <dockerhub-username> [version]

set -e

DOCKER_USER="${1:?Usage: $0 <dockerhub-username> [version]}"
VERSION="${2:-latest}"
REGISTRY="docker.io/${DOCKER_USER}"

cd "$(dirname "$0")/.."

echo ""
echo "🔨 Building images for ${REGISTRY} (tag: ${VERSION})"
echo ""

# 1. Database (Prisma + migrations)
echo "📦 Building database..."
docker build -t ${REGISTRY}/nida-database:${VERSION} -f database/Dockerfile database/

# 2. Blockchain (Hardhat)
echo "📦 Building blockchain..."
docker build -t ${REGISTRY}/nida-blockchain:${VERSION} -f blockchain/Dockerfile blockchain/

# 3. Backend (Node.js API)
echo "📦 Building backend..."
docker build -t ${REGISTRY}/nida-backend:${VERSION} -f backend/Dockerfile .

# 4. Frontend (Vite + Nginx)
echo "📦 Building frontend..."
docker build -t ${REGISTRY}/nida-frontend:${VERSION} \
  --build-arg REACT_APP_API="${REACT_APP_API:-http://localhost:8000/api/}" \
  --build-arg REACT_APP_MOCKUPMODE="${REACT_APP_MOCKUPMODE:-false}" \
  -f frontend-vite/Dockerfile frontend-vite/

echo ""
echo "🚀 Pushing images to Docker Hub..."
echo ""

docker push ${REGISTRY}/nida-database:${VERSION}
docker push ${REGISTRY}/nida-blockchain:${VERSION}
docker push ${REGISTRY}/nida-backend:${VERSION}
docker push ${REGISTRY}/nida-frontend:${VERSION}

echo ""
echo "✅ Done! Images at:"
echo "   ${REGISTRY}/nida-database:${VERSION}"
echo "   ${REGISTRY}/nida-blockchain:${VERSION}"
echo "   ${REGISTRY}/nida-backend:${VERSION}"
echo "   ${REGISTRY}/nida-frontend:${VERSION}"
echo ""
echo "📋 On VMs, pull with:"
echo "   docker pull ${REGISTRY}/nida-frontend:${VERSION}"
echo "   docker pull ${REGISTRY}/nida-backend:${VERSION}"
echo "   docker pull ${REGISTRY}/nida-blockchain:${VERSION}"
echo "   docker pull ${REGISTRY}/nida-database:${VERSION}"
