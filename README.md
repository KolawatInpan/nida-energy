# nida-dashboard-ui

Lightweight local dev setup for the NIDA energy dashboard (frontend, backend, Postgres, blockchain).

Quick start (recommended)

1. Clone repo
2. Start everything with Docker Compose:

```bash
docker compose up --build
```

Dev mode (hot reload):

```bash
docker compose -f docker-compose.dev.yml up --build
```

Services (defaults)
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- pgAdmin: http://localhost:5050
- Prisma Studio: http://localhost:5555
- Postgres: localhost:5432 (inside compose the host is `db:5432`)

Database files
- Prisma schema: database/schema.prisma
- Migrations: database/migrations

Reset local DB

```bash
docker compose down -v
docker compose up --build
```

Useful commands

```bash
docker compose up --build
docker compose -f docker-compose.dev.yml up --build
docker compose down
docker compose logs -f backend
docker compose exec db psql -U postgres -d energy_trading
```

Prisma (from host)

```bash
npx prisma generate --schema=database/schema.prisma
npx prisma db push --schema=database/schema.prisma
```

If you want any section expanded (testing, local setup without Docker, or CI notes), tell me which part and I'll add it.
