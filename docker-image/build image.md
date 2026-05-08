docker compose build frontend
docker compose build backend
docker compose build blockchain
docker compose build prisma

docker save -o ./docker-image/nida-frontend.tar nida-frontend:latest
docker save -o ./docker-image/nida-backend.tar nida-backend:latest
docker save -o ./docker-image/nida-blockchain.tar nida-blockchain:latest
docker save -o ./docker-image/nida-database.tar nida-database:latest

docker save -o ./docker-image/postgres.tar postgres:16-alpine
docker save -o ./docker-image/pgadmin.tar dpage/pgadmin4:9
