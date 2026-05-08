full node
ssh -i C:\Users\NidaS\Downloads\bc.pem ubuntu@10.10.161.232

database
ssh -i C:\Users\NidaS\Downloads\bc.pem ubuntu@10.10.161.233


webproxy
ssh -i C:\Users\NidaS\Downloads\bc.pem ubuntu@10.10.161.210

sudo apt update

install Docker Offline into all 4VMs
fullnode
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\containerd.io_1.7.28-0~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce-cli_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-buildx-plugin_0.10.2-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-compose-plugin_2.15.1-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~

database
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\containerd.io_1.7.28-0~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.233:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce-cli_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.233:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.233:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-buildx-plugin_0.10.2-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.233:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-compose-plugin_2.15.1-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.233:~

web-proxy
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\containerd.io_1.7.28-0~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.210:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce-cli_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.210:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.210:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-buildx-plugin_0.10.2-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.210:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-compose-plugin_2.15.1-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.210:~

lightnode
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\containerd.io_1.7.28-0~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce-cli_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-ce_23.0.0-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-buildx-plugin_0.10.2-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-compose-plugin_2.15.1-1~ubuntu.22.04~jammy_amd64.deb" ubuntu@10.10.161.232:~


sudo dpkg -i *.deb


Send Image to each VM
BACKEND BLOCKCHAIN 232
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\nida-backend.tar" ubuntu@10.10.161.232:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\nida-blockchain.tar" ubuntu@10.10.161.232:~
sudo docker load -i nida-backend.tar
sudo docker load -i nida-blockchain.tar
sudo docker compose up -d --no-deps backend blockchain

DATABASE
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\nida-database.tar" ubuntu@10.10.161.233:~
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\nida-pgadmin.tar" ubuntu@10.10.161.233:~
sudo docker load -i nida-database.tar
sudo docker load -i nida-pgadmin.tar

FRONTEND
scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\nida-frontend.tar" ubuntu@10.10.161.210:~
sudo docker load -i nida-frontend.tar
sudo docker compose up -d --no-deps frontend

scp -i "C:\Users\NidaS\Downloads\bc.pem" "C:\Users\NidaS\Downloads\docker-compose.yml" ubuntu@10.10.161.210:~

sudo docker load -i nida-pgadmin.tar
docker compose -f docker-compose.db.yml up -d


