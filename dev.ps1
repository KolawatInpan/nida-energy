# NIDA Dashboard - Dev wrapper
# Usage: .\dev.ps1 up -d   |   .\dev.ps1 down   |   .\dev.ps1 logs -f
docker compose -f docker-compose.dev.yml --env-file .env.dev @args
