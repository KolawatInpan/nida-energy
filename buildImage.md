docker build -t nida-backend:latest -f backend/Dockerfile .
docker build -t nida-blockchain:latest -f blockchain/Dockerfile .
docker build -t nida-database:latest -f database/Dockerfile .
docker build -t nida-frontend-vite:latest -f frontend-vite/Dockerfile .

docker tag nida-backend:latest diaboliccz/nida-backend:latest
docker tag nida-blockchain:latest diaboliccz/nida-blockchain:latest
docker tag nida-database:latest diaboliccz/nida-database:latest
docker tag nida-frontend-vite:latest diaboliccz/nida-frontend-vite:latest

docker push diaboliccz/nida-backend:latest
docker push diaboliccz/nida-blockchain:latest
docker push diaboliccz/nida-database:latest
docker push diaboliccz/nida-frontend-vite:latest