# NIDA Smart Grid — Network Architecture Diagram

## Physical Network Topology

```mermaid
graph TB
    subgraph "Your PC (Developer)"
        PC["💻 Your PC
            10.10.161.x (VPN client)
            Ports: 8080, 8000, 5050"]
    end

    subgraph "Internet / VPN"
        VPN["🔒 VPN Tunnel
             (True Internet / OpenVPN)"]
    end

    subgraph "OpenStack Cloud — compute3 (Jump Host)"
        COMPUTE3["🖥️ Compute3
                    IP: 10.10.161.239
                    Secondary IP: 10.10.161.224
                    Bridge: brqc1bfef02-90"]
        
        subgraph "Nginx Reverse Proxy (compute3)"
            NGINX_WEB["🔀 nida-web-8080
                        listen 10.10.161.224:8080
                        → proxy_pass 192.168.100.224:80"]
            NGINX_API["🔀 nida-backend
                        listen 10.10.161.224:8000
                        → proxy_pass 192.168.100.221:8000"]
            NGINX_PGA["🔀 nida-pgadmin
                        listen 10.10.161.224:5050
                        → proxy_pass 192.168.100.221:5050"]
        end

        FW_IPTABLES["🛡️ iptables
                     INPUT: ACCEPT tcp dpt:8080, 8000, 5050
                     (for 10.10.161.224)"]
    end

    subgraph "Private Network — 192.168.100.0/24"
        subgraph "fullnode VM (192.168.100.221)"
            FULLNODE["🖥️ fullnode VM
                       IP: 192.168.100.221"]
            BC["⛓️ Blockchain (Hardhat)
                 Container: nida-blockchain
                 Port: 8545"]
            API["⚙️ Backend API (Express.js)
                  Container: nida-backend
                  Port: 8000"]
            DB["🗄️ PostgreSQL 16
                 Container: nida-db
                 Port: 5432"]
            PGA["🗄️ pgAdmin
                  Container: nida-pgadmin
                  Port: 5050"]
            PRISMA["🔗 Prisma ORM
                     Container: nida-prisma"]
        end

        subgraph "webproxy VM (192.168.100.224)"
            WEBVM["🖥️ webproxy VM
                    IP: 192.168.100.224"]
            FE["🌐 Frontend (React + Vite)
                 Container: nida-frontend
                 Nginx: port 80"]
        end
    end

    %% Connections
    PC -- "VPN" --> VPN
    VPN -- "10.10.161.x" --> COMPUTE3

    %% From PC to compute3 services
    PC -- "🌐 http://10.10.161.224:8080" --> NGINX_WEB
    PC -- "🔌 http://10.10.161.224:8000/api/" --> NGINX_API
    PC -- "🗄️ http://10.10.161.224:5050" --> NGINX_PGA
    PC -- "📖 http://10.10.161.224:8000/api-docs" --> NGINX_API

    %% From compute3 to VMs (via bridge)
    NGINX_WEB -- "192.168.100.224:80" --> FE
    NGINX_API -- "192.168.100.221:8000" --> API
    NGINX_PGA -- "192.168.100.221:5050" --> PGA

    %% Internal connections (all same VM — localhost)
    API -- "localhost:5432" --> DB
    PRISMA -- "localhost:5432" --> DB
    PGA -- "localhost:5432" --> DB
    API -- "localhost:8545" --> BC

    %% Styling
    classDef pc fill:#e1f5fe,stroke:#0288d1
    classDef cloud fill:#f3e5f5,stroke:#7b1fa2
    classDef proxy fill:#fff3e0,stroke:#f57c00
    classDef vm fill:#e8f5e9,stroke:#388e3c
    classDef service fill:#fce4ec,stroke:#c62828
    classDef db fill:#f3e5f5,stroke:#6a1b9a
    classDef block fill:#e0f2f1,stroke:#00796b

    class PC pc
    class COMPUTE3 cloud
    class NGINX_WEB,NGINX_API,NGINX_PGA proxy
    class FULLNODE,WEBVM vm
    class FE,API,PRISMA service
    class DB,PGA db
    class BC block
```

## URL Access Summary

| Service | External URL (from PC) | Backend Target | Container | VM |
|---------|----------------------|---------------|-----------|-----|
| **Frontend UI** | `http://10.10.161.224:8080` | `192.168.100.224:80` | `nida-frontend` | webproxy |
| **Backend API** | `http://10.10.161.224:8000/api/` | `192.168.100.221:8000` | `nida-backend` | fullnode |
| **Swagger UI** | `http://10.10.161.224:8000/api-docs` | `192.168.100.221:8000` | `nida-backend` | fullnode |
| **pgAdmin** | `http://10.10.161.224:5050` | `192.168.100.221:5050` | `nida-pgadmin` | fullnode |

## VM & IP Reference

| Hostname | Private IP | OpenStack IP | Role | Running Containers |
|----------|-----------|-------------|------|-------------------|
| **compute3** | — | `10.10.161.239` (primary) | Jump host + Reverse proxy | Nginx (system) |
| | — | `10.10.161.224` (secondary) | Public-facing IP for services | — |
| **bc-fullnode** | `192.168.100.221` | — | Backend + Blockchain + DB + pgAdmin | `nida-backend`, `nida-blockchain`, `nida-db`, `nida-pgadmin`, `nida-prisma` |
| **bc-webproxy** | `192.168.100.224` | — | Frontend | `nida-frontend` |

## Docker Compose Profiles

| Profile | VM | Containers |
|---------|-----|-----------|
| `node` | fullnode (221) | `blockchain`, `backend` |
| `proxy` | webproxy (224) | `frontend` |
| `fullnode` | fullnode (221) | `pgadmin` (extra) |
| *(manual)* | fullnode (221) | `db`, `prisma` |

## Traffic Flow Example (Login)

```
Browser → http://10.10.161.224:8080
  ↓ (TCP 8080)
Compute3 nginx (10.10.161.224:8080)
  ↓ (proxy_pass)
Webproxy VM (192.168.100.224:80) → nida-frontend (React SPA)
  ↓
JS calls http://10.10.161.224:8000/api/users/login
  ↓ (TCP 8000)
Compute3 nginx (10.10.161.224:8000)
  ↓ (proxy_pass)
Fullnode VM (192.168.100.221:8000) → nida-backend
  ↓ (Prisma query)
Fullnode VM localhost:5432 → nida-db (PostgreSQL)
```
