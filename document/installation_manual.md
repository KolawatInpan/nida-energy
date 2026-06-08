# NIDA Smart Grid — คู่มือการติดตั้ง (Docker)

> **สำหรับ**: ผู้ดูแลระบบ, DevOps  
> **อัปเดตล่าสุด**: 2026-06-08  
> **รองรับ**: Docker 24+, Docker Compose v2

---

## ภาพรวม Infrastructure

```
Your PC (dev)          Compute3 (jump host)          VMs
┌──────────┐   VPN    ┌──────────────────┐    ┌─────────────────┐
│ WSL/Docker│ ──────→ │ 10.10.161.239     │ ──→│ 192.168.100.221 │ fullnode
│ localhost │         │ (NAT forward)     │    │ 192.168.100.222 │ database
└──────────┘          └──────────────────┘    │ 192.168.100.224 │ webproxy
                                               └─────────────────┘
```

| VM | IP | บทบาท | Docker Profile |
|----|----|-------|---------------|
| **fullnode** | 192.168.100.221 | Blockchain node + Backend API + Prisma | `node` |
| **database** | 192.168.100.222 | PostgreSQL 16 + pgAdmin (port 5050) | `data` |
| **webproxy** | 192.168.100.224 | Frontend nginx (port 80) + Backend (port 8000) | `proxy` |

---

## 1. ความต้องการของระบบ

### ขั้นต่ำ
- **Docker** 24.0+
- **Docker Compose** v2
- **Git**
- **VPN** เข้าเครือข่าย 10.10.161.x (สำหรับ push/pull images)

### Docker Images
| Image | Registry | VM |
|-------|----------|-----|
| `diaboliccz/nida-backend:latest` | Docker Hub | fullnode |
| `diaboliccz/nida-frontend:latest` | Docker Hub | webproxy |
| `postgres:16` | Docker Hub | database |
| `dpage/pgadmin4:latest` | Docker Hub | database |

---

## 2. Environment Variables (.env)

สร้างไฟล์ `.env` ที่ root ของโปรเจค:

```env
# === Database ===
DATABASE_URL=postgresql://nida:nida_password@db:5432/nida_smart_grid
POSTGRES_USER=nida
POSTGRES_PASSWORD=nida_password
POSTGRES_DB=nida_smart_grid

# === Demo Database (แยก instance) ===
DEMO_DATABASE_URL=postgresql://nida:nida_password@db:5432/nida_smart_grid_demo
DEFAULT_DATA_MODE=real

# === JWT ===
JWT_SECRET=your_jwt_secret_here_change_me

# === Email (OTP via Gmail SMTP) ===
GMAIL_USER=your_email@gmail.com
GMAIL_PASS=your_app_password        # App Password — ไม่ใช่รหัสผ่านปกติ
                                     # สร้างที่: https://myaccount.google.com/apppasswords

# === Blockchain ===
BLOCKCHAIN_RPC_URL=http://blockchain:8545

# === Frontend ===
FRONTEND_URL=http://192.168.100.224:80
```

> ⚠️ **สำคัญ**: ถ้าเพิ่ม env var ใหม่ ต้องเพิ่มใน `docker-compose.yml` ใต้ `environment:` ของ service นั้นๆ ด้วย

---

## 3. Docker Compose Profiles

`docker-compose.yml` แบ่งออกเป็น 3 profiles:

```bash
# Database VM
COMPOSE_PROFILES=data docker compose up -d      # db, pgadmin, prisma

# Fullnode VM
COMPOSE_PROFILES=node docker compose up -d      # blockchain, backend

# Webproxy VM
COMPOSE_PROFILES=proxy docker compose up -d     # frontend
```

---

## 4. ขั้นตอนการ Deploy

### 4.1 Build Images (จากเครื่อง Dev)

```powershell
# Build backend (PowerShell — ใช้ ; ไม่ใช่ &&)
cd C:\Users\KolawatLT\workspace\nida-dashboard-ui
docker compose build backend --no-cache
docker compose build frontend --no-cache

# Push ขึ้น Docker Hub
docker push diaboliccz/nida-backend:latest
docker push diaboliccz/nida-frontend:latest
```

### 4.2 Deploy ไปยัง VMs

#### Fullnode VM (192.168.100.221)
```bash
ssh ubuntu@192.168.100.221
cd ~/nida-dashboard-ui
sudo docker pull diaboliccz/nida-backend:latest
sudo COMPOSE_PROFILES=node docker compose up -d --force-recreate backend
```

#### Webproxy VM (192.168.100.224)
```bash
ssh ubuntu@192.168.100.224
cd ~/nida-dashboard-ui
sudo docker pull diaboliccz/nida-frontend:latest
sudo COMPOSE_PROFILES=proxy docker compose up -d --force-recreate frontend
```

#### Database VM (192.168.100.222)
```bash
ssh ubuntu@192.168.100.222
cd ~/nida-dashboard-ui
sudo COMPOSE_PROFILES=data docker compose up -d
```

---

## 5. คำสั่ง Docker ที่ใช้บ่อย

```bash
# ดูสถานะ containers
sudo docker ps

# ดู logs
sudo docker logs nida-backend -f --tail 100
sudo docker logs nida-frontend -f --tail 100

# Restart (code เปลี่ยน ไม่มี env เปลี่ยน)
sudo COMPOSE_PROFILES=node docker compose up -d --no-deps backend

# Restart (env เปลี่ยน — ต้อง re-read .env)
sudo COMPOSE_PROFILES=node docker compose up -d --force-recreate backend

# หยุด
sudo docker compose down

# Prisma migration (บน fullnode VM)
sudo docker exec nida-backend npx prisma migrate deploy
```

### `--force-recreate` vs `--no-deps`
| Flag | ใช้เมื่อ |
|------|--------|
| `--force-recreate` | env vars เปลี่ยน, .env แก้ไข |
| `--no-deps` | แค่ code เปลี่ยน (restart เร็วขึ้น) |

---

## 6. การ Transfer Images แบบ Offline

กรณี VM ไม่สามารถ pull จาก Docker Hub ได้:

```powershell
# บนเครื่อง Dev
docker save diaboliccz/nida-backend:latest -o nida-backend.tar
scp -i "C:\path\to\key.pem" nida-backend.tar ubuntu@192.168.100.221:~

# บน VM
sudo docker load -i nida-backend.tar
sudo COMPOSE_PROFILES=node docker compose up -d --force-recreate backend
```

---

## 7. Compute3 Recovery (หลัง Reboot)

เมื่อ Compute3 (jump host) reboot ต้อง re-apply:

```bash
# 1. เพิ่ม secondary IP (ไม่ persistent หลัง reboot)
sudo ip addr add 10.10.161.224/24 dev brqc1bfef02-90

# 2. เพิ่ม iptables rules (NAT forward ไป webproxy)
sudo iptables -t nat -A PREROUTING -d 10.10.161.224 -p tcp --dport 80 -j DNAT --to-destination 192.168.100.224:80

# 3. Restart nginx
sudo systemctl restart nginx
```

> 💡 **ทำให้ permanent**:  
> ```bash
> sudo apt install iptables-persistent
> sudo netfilter-persistent save
> ```

---

## 8. Prisma Migration (เฉพาะ Database VM)

```bash
# บน database VM (192.168.100.222)
sudo COMPOSE_PROFILES=data docker compose up -d db

# รัน migration จาก fullnode VM (192.168.100.221)
sudo docker exec nida-backend npx prisma migrate deploy

# หรือ run Prisma Studio (GUI ดูข้อมูล)
sudo docker exec nida-backend npx prisma studio
```

---

## 9. การตรวจสอบหลัง Deploy

```bash
# 1. Backend health check
curl http://192.168.100.221:8000/api/health

# 2. Frontend เข้าถึงได้
curl http://192.168.100.224:80

# 3. ผ่าน Compute3 NAT
curl http://10.10.161.224:80

# 4. Database
sudo docker exec nida-db psql -U nida -d nida_smart_grid -c "SELECT count(*) FROM \"Building\";"

# 5. pgAdmin
# เปิดเบราว์เซอร์ → http://192.168.100.222:5050
# Login: admin@nida.com / admin
```

---

## 10. ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|-------|--------|--------|
| **Docker ไม่สนใจ .env** | env vars ถูก cache ใน container | ใช้ `--force-recreate` |
| **Frontend build 440MB** | `context: .` ส่งทั้ง repo | เปลี่ยนเป็น `context: ./frontend-vite` |
| **เข้าหน้าเว็บไม่ได้** | Compute3 iptables หาย (หลัง reboot) | ทำตามขั้นตอน Compute3 Recovery |
| **OTP ไม่ส่ง** | Gmail App Password หมดอายุ | สร้างใหม่ที่ https://myaccount.google.com/apppasswords |
| **Pull image ไม่ได้จาก VM** | VM ไม่มี internet | ใช้วิธี transfer แบบ offline |
| **Prisma migration ล้มเหลว** | Database URL ไม่ตรง | เช็ค `DATABASE_URL` ใน `.env` |

---

## 11. การรันบน Local Dev

```bash
# รันเฉพาะ database
docker compose up -d db

# รัน backend (แบบ dev — ไม่ใช้ Docker)
cd backend
npm install
npx prisma migrate dev
npm run dev          # port 8000

# รัน frontend (แบบ dev — ไม่ใช้ Docker)
cd frontend-vite
npm install
npm run dev          # port 5173

# รัน blockchain node (Hardhat)
cd blockchain
npm install
npx hardhat node     # port 8545
```

---

## 12. Cron Jobs บน Production

| Job | Schedule | ไฟล์ |
|-----|----------|------|
| Mock Energy Generator | ทุกชั่วโมง | `backend/features/energy/energyAggregation.js` |
| Auto-Trade Engine | 15:00 น. ทุกวัน | `backend/features/trading/trade.engine.js` |
| Day-Ahead Market Clearing | ~00:00 น. ทุกวัน | `backend/features/trading/market.service.js` |

---

## แหล่งอ้างอิง

- **DEEPSEEK.md** — ไฟล์ context หลักของโปรเจค
- **docker-compose.yml** — อยู่ที่ root ของโปรเจค
- **.env** — environment variables (ต้องสร้างเอง, ไม่ commit เข้า git)
