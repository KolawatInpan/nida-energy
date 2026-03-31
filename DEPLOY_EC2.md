# EC2 + Docker Compose Deploy

This setup runs `frontend + backend + postgres + blockchain` on one EC2 machine for demo/thesis deployment.

## 1. Prepare EC2

- Ubuntu 22.04 or similar
- Recommended instance for demo: `t3.small` or `t3.medium`
- Recommended storage: at least `20 GB`
- Open Security Group ports:
  - `22` for SSH
  - `80` for web access
  - `8545` only if you want public blockchain RPC access

AWS checklist before SSH:

- Create or reuse an EC2 key pair
- Launch the instance in a public subnet
- Assign a public IPv4 or Elastic IP
- Attach a Security Group with `22` and `80` open
- Make sure the instance can reach the internet for Docker image/package download

## 2. Install Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

Log out and SSH back in once after adding your user to the `docker` group.

## 3. Upload project

```bash
git clone <your-repo-url>
cd nida-dashboard-ui
cp .env.ec2.example .env.ec2
```

If you deploy from your local machine with SSH:

```bash
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Edit `.env.ec2` and set at least:

- `POSTGRES_PASSWORD`
- `SECRET_KEY`
- `FRONTEND_URL`

Example:

```env
FRONTEND_URL=http://3.108.10.20
POSTGRES_PASSWORD=super-secure-password
SECRET_KEY=replace-with-a-long-random-secret
```

Recommended values for a quick demo:

```env
RUN_PRISMA_DB_PUSH=true
RUN_PRISMA_MIGRATE=false
DEFAULT_DATA_MODE=real
```

## 4. Start services

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --build
```

## 5. Check status

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml ps
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml logs -f backend
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml logs -f frontend
```

## 6. Open app

Open:

```text
http://YOUR_EC2_PUBLIC_IP
```

The frontend proxies `/api` to the backend internally, so users only need port `80`.

Health checks you can try after deploy:

```text
http://YOUR_EC2_PUBLIC_IP
http://YOUR_EC2_PUBLIC_IP/api/health
```

## Useful commands

Restart:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml restart
```

Rebuild after code changes:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --build
```

Stop:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml down
```

Stop and remove DB container but keep DB data:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml down
```

Remove everything including database volume:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml down -v
```

## Notes

- `RUN_PRISMA_DB_PUSH=true` is convenient for demo deployment. For stricter production flow, switch to migrations.
- PostgreSQL data is stored in the Docker volume `postgres_data`.
- If you later attach a domain, put Nginx/ALB/Cloudflare in front and point it to port `80`.
- Keep `.env.ec2` only on your machine/server. It is ignored by git.
