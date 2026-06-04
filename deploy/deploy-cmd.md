# Deploy Commands — NIDA Energy Trading

## 🏗️ Architecture (2 VMs)

```
Your PC                     Compute3 (jump)              VMs
┌──────────┐    VPN     ┌──────────────────┐     ┌─────────────────┐
│ build    │ ────────→ │ 10.10.161.239     │ ──→ │ 192.168.100.221 │ fullnode
│ images   │           │ (NAT forward)     │     │                 │  ← db + pgadmin + prisma
│ push to  │           │                   │     │                 │     + blockchain + backend
│ DockerHub│           │                   │     ├─────────────────┤
└──────────┘           │                   │     │ 192.168.100.224 │ webproxy
                       │                   │     │                 │  ← frontend only
                       └──────────────────┘     └─────────────────┘
```

## 1. Build & Push Images (on your PC)

```bash
# Login to Docker Hub
docker login

# Build & push all images
./deploy/build-push.sh <your-dockerhub-username> latest
```

## 2. Connect to VMs via Jump Host

```bash
# Step 1: Connect VPN
sudo openconnect --protocol=gp vpnguest.nida.ac.th

# Step 2: SSH jump host
ssh ssa@10.10.161.239
# password: Obfhk2565

# Step 3: From jump → VMs
ssh ubuntu@192.168.100.221   # fullnode (db + blockchain + backend)
ssh ubuntu@192.168.100.224   # webproxy (frontend only)
```

## 3. Setup NAT on Compute3 (first time only)

```bash
# On compute3 (ssa@10.10.161.239):
sudo sysctl -w net.ipv4.ip_forward=1

# Forward HTTP/HTTPS to webproxy
sudo iptables -t nat -A PREROUTING -i brqc1bfef02-90 -p tcp --dport 80 -j DNAT --to-destination 192.168.100.224:80
sudo iptables -t nat -A PREROUTING -i brqc1bfef02-90 -p tcp --dport 443 -j DNAT --to-destination 192.168.100.224:443
sudo iptables -A FORWARD -i brqc1bfef02-90 -o brq41ec208d-27 -p tcp -d 192.168.100.224 -j ACCEPT
sudo iptables -t nat -A POSTROUTING -o brq41ec208d-27 -j MASQUERADE
```

## 4. Deploy on VMs

```bash
# Clone repo on each VM (first time)
git clone <repo-url> && cd nida-dashboard-ui

# Pull latest code (if already cloned)
git pull

# --- fullnode VM (192.168.100.221) ---
# Deploys: db + pgadmin + prisma + blockchain + backend
./deploy/vm-deploy.sh <dockerhub-user> latest fullnode

# --- webproxy VM (192.168.100.224) ---
# Deploys: frontend only
./deploy/vm-deploy.sh <dockerhub-user> latest frontend
```

## 5. Access

```
https://10.10.161.239  →  webproxy (frontend)
http://10.10.161.239:8000  →  backend API
```

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


# VM3 — database (ต้องรันก่อน)
docker compose --profile data up -d

# VM2 — full node
docker compose --profile fullnode up -d

# VM1 — web proxy
docker compose --profile proxy up -d