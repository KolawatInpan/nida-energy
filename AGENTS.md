# AGENTS.md

> Instructions for AI coding agents working on this project.
> For full project context, read `CONTEXT.md`.

---

## Quick Commands

### Dev Server
```bash
# Start full dev environment
docker compose -f docker-compose.dev.yml up -d

# Restart only backend (code changes)
docker compose -f docker-compose.dev.yml restart backend

# View backend logs
docker compose -f docker-compose.dev.yml logs -f backend
```

### Validate
```bash
# Validate Prisma schema (run from database/ or backend/)
npx prisma validate --schema=../database/schema.prisma

# Generate Prisma client
npx prisma generate --schema=../database/schema.prisma
```

### Test
```bash
# Unit tests (from backend/)
cd backend && npm test

# Integration tests
cd backend && npm run test:integration
```

> ⚠️ No ESLint or Prettier configured. No frontend test suite.

---

## Before Submitting Changes

1. **Prisma schema valid** — `npx prisma validate --schema=../database/schema.prisma`
2. **No direct PrismaClient imports** — use `const { prisma } = require('../../utils/prisma')`
3. **No email as PK** — User PK is `credId` (UUID), email is shared across all users
4. **No axios in frontend pages** — always go through `core/data_connecter/`
5. **No top-level circular requires** — use lazy `require()` inside function body
6. **Wallet tied to Building** — use `buildingId`, not email
7. **BuildingAssignment for user-building** — not `Building.email` (removed)

---

## Code Style

### Backend (Node.js / Express)
- **Module system**: CommonJS (`require` / `module.exports`), NOT ES modules
- **Async**: `async/await`, wrap with `asyncHandler` for route handlers
- **Error format**: `{ error: "Human-readable message" }` with appropriate HTTP status
- **Success format**: `{ success: true, data: ... }`
- **Imports**: Always use prisma proxy, never import PrismaClient directly
- **Feature structure**: `routes.js` → `controller.js` → `service.js` → `repository.js` (or combined `model.js`)

### Frontend (React + Vite)
- **Components**: Functional components with hooks, class components not used
- **Styling**: Tailwind CSS utility classes, no CSS modules
- **UI library**: Ant Design 4 (`antd`)
- **State**: Redux Toolkit + redux-persist (auth state), local `useState` for page state
- **API calls**: Through `core/data_connecter/` functions, never raw axios in pages
- **Error handling**: `notification.error()` from antd or local toast state
- **Naming**: Pages `camelCase.js`, Components `camelCase.js`, Data connectors `camelCase.js`

### Database / Prisma
- **Schema location**: `database/schema.prisma` (single source of truth)
- **Proxy pattern**: `utils/prisma.js` uses AsyncLocalStorage to switch real/demo DB
- **Field naming**: `kwh` (lowercase) for energy tables, `kWH` (uppercase) for RunningMeter/MeterInfo
- **ID fields**: `meterSnid` (not `meterId`) for energy tables, `snid` for MeterInfo/RunningMeter

---

## Common Pitfalls

| Mistake | Fix |
|---------|-----|
| `new PrismaClient()` | Use `const { prisma } = require('../../utils/prisma')` |
| `axios.get()` in page file | Move to `core/data_connecter/`, import from there |
| `require` at top of file causing circular dep | Move inside the function body |
| `batteryPct` or `soc` > 100 | Cap with `Math.min(100, Math.max(0, value))` |
| Using `email` to identify User | Use `credId` (UUID) — email is shared across all users |
| Using `Building.email` | Removed — use `assignedContactEmail` or `BuildingAssignment` |
| Using `Wallet.email` | Removed — use `buildingId` FK to Building |
| `&&` in PowerShell commands | Use `;` instead |
| Querying building by name with spaces | Use `buildingId` param or `normalizeBackendBuildingName()` |

---

## Deployment (2 VMs)

| VM | IP | Runs |
|----|----|------|
| **fullnode** | 192.168.100.221 | PostgreSQL, Prisma, Backend, Blockchain (Hardhat) |
| **webproxy** | 192.168.100.224 | Frontend (nginx), Backend (port 8000) |

```bash
# Build images locally
docker compose build backend --no-cache
docker compose build frontend --no-cache
docker push diaboliccz/nida-backend:latest
docker push diaboliccz/nida-frontend:latest

# Deploy on fullnode VM
sudo COMPOSE_PROFILES=fullnode docker compose up -d --force-recreate

# Deploy on webproxy VM
sudo COMPOSE_PROFILES=proxy docker compose up -d --force-recreate frontend
```

`pull_policy: always` is set on both app services, so the VMs always fetch the
pushed tag — forgetting `docker push` silently re-deploys the previous image.

### Environment on a fresh VM

`.env` and `.env.dev` are gitignored and do not travel with the repo. Copy the
template and fill in every `REQUIRED` value before the first `up`:

```bash
cp .env.example .env
```

### Schema changes before deploying

The backend container runs this on **every** boot (`backend/Dockerfile` CMD):

```
sh /app/prisma/push-both-dbs.sh --accept-data-loss --schema /app/prisma/schema.prisma
```

`db push` cannot add a **required** column to a table that already has rows.
`--accept-data-loss` does not help — it permits dropping data, not inventing it
for existing rows. Deploying such a schema onto a populated database makes the
backend crash-loop with `... without a default value`.

Two ways out:

| Situation | Action |
|-----------|--------|
| Data can be discarded (demo / test VMs) | Drop the volume and let init recreate both DBs, then deploy normally |
| Data must survive | Apply a hand-written backfill under `database/migrations/` **before** deploying, so the new columns already exist and are populated |

Dropping the volume also re-runs `database/init/01-create-demo-db.sql`, which is
the only thing that creates `energy_trading_demo`:

```bash
sudo docker compose down
sudo docker volume rm <project>_postgres_data
sudo COMPOSE_PROFILES=fullnode docker compose up -d
```

After a bulk registration on a fresh install, meters land as `approveStatus:
pending`, and both `energyFeed.routes.js` and `meterMonitor.cron.js` filter to
`approved` — approve them in the UI or no energy data will flow.
