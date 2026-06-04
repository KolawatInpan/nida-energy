# ==== ON YOUR PC ====

# Login Docker Hub
docker login

# Build & Push ALL in ONE command
cd ~/nida-dashboard-ui
DOCKER_USER=diaboliccz docker compose build
docker compose build
DOCKER_USER=diaboliccz docker compose push

# On VMs — pull & run
DOCKER_USER=diaboliccz docker compose pull
DOCKER_USER=diaboliccz docker compose up -d


# ==== CONNECT TO VMs ====

# VPN
sudo openconnect --protocol=gp vpnguest.nida.ac.th

# Jump host
ssh ssa@10.10.161.239


# ==== ON COMPUTE3 (first time only) ====

sudo sysctl -w net.ipv4.ip_forward=1

sudo iptables -t nat -A PREROUTING -i brqc1bfef02-90 -p tcp --dport 80 -j DNAT --to-destination 192.168.100.224:80
sudo iptables -t nat -A PREROUTING -i brqc1bfef02-90 -p tcp --dport 443 -j DNAT --to-destination 192.168.100.224:443
sudo iptables -A FORWARD -i brqc1bfef02-90 -o brq41ec208d-27 -p tcp -d 192.168.100.224 -j ACCEPT
sudo iptables -t nat -A POSTROUTING -o brq41ec208d-27 -j MASQUERADE


# ==== ON EACH VM (from jump) ====

# Database VM
ssh ubuntu@192.168.100.222
cd ~/nida-dashboard-ui && git pull
./deploy/vm-deploy.sh kolawatlt latest db

# Fullnode VM
ssh ubuntu@192.168.100.221
cd ~/nida-dashboard-ui && git pull
./deploy/vm-deploy.sh kolawatlt latest blockchain

# Webproxy VM
ssh ubuntu@192.168.100.224
cd ~/nida-dashboard-ui && git pull
./deploy/vm-deploy.sh kolawatlt latest all


# ==== ACCESS ====

# https://10.10.161.239        (frontend)
# http://10.10.161.239:8000    (backend)