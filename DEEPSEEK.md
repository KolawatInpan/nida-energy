# NIDA Smart Grid — AI Context File

> **Project**: NIDA Energy Trading & Analytics Platform  
> **Purpose**: A decentralized energy trading system for buildings in a microgrid, enabling peer-to-peer energy trading, real-time monitoring, blockchain verification, and automated billing.
> **Target Users**: Building managers, grid operators, and administrators.

---

## 1. 🔭 Project Overview

NIDA Smart Grid is a full-stack web application that manages energy production/consumption across multiple buildings. It integrates IoT meter data, blockchain transaction verification, an energy marketplace (Day-Ahead & Intraday), automated invoicing, and wallet-based token payments.

### High-Level Architecture

```
[IoT Meters] → [Backend API] → [PostgreSQL]
                   ↓
            [Blockchain] ← [Hardhat Node]
                   ↓
            [Transaction Verification]
                   ↓
            [Frontend UI (React)]
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 18+ | Backend server |
| **Framework** | Express.js | REST API |
| **ORM** | Prisma 5+ | Dual DB (real + demo) via AsyncLocalStorage Proxy |
| **Database** | PostgreSQL 16 | Relational data store |
| **Frontend** | React 18 + Vite | SPA UI |
| **UI Library** | Ant Design 5 | Component library |
| **Styling** | Tailwind CSS | Utility CSS |
| **Charts** | Recharts | Data visualization |
| **Blockchain** | Hardhat (local) | Smart contract deployment & verification |
| **Email** | Nodemailer + Gmail SMTP | OTP delivery |
| **Infrastructure** | Docker Compose | Container orchestration across 3 VMs |

### Infrastructure Map

```
Your PC (dev)          Compute3 (jump host)          VMs
┌──────────┐   VPN    ┌──────────────────┐    ┌─────────────────┐
│ WSL/Docker│ ──────→ │ 10.10.161.239     │ ──→│ 192.168.100.221 │ fullnode
│ localhost │         │ (NAT forward)     │    │ 192.168.100.222 │ database
└──────────┘          └──────────────────┘    │ 192.168.100.224 │ webproxy
                                               └─────────────────┘
```

- **fullnode (192.168.100.221)**: Blockchain node + Backend API + Prisma
- **database (192.168.100.222)**: PostgreSQL 16 + pgAdmin (port 5050)
- **webproxy (192.168.100.224)**: Frontend nginx (port 80) + Backend (port 8000)

---

## 1.5 🧠 Decision Log (Why We Built It This Way)

> For AI: Use this section to understand WHY decisions were made, so you don't suggest alternatives that contradict project constraints.

| Decision | Rationale | When NOT to change |
|----------|-----------|-------------------|
| **Prisma Proxy + AsyncLocalStorage** | Dual DB (real/demo) per request, selected by middleware. Avoids multiple PrismaClient instances. | When adding new features, always import from `../../utils/prisma` |
| **Solar + Battery trade modes independent** | A building may want auto-sell solar but manual battery (or vice versa). Single `tradeMode` was legacy. | New mode values must be added to `TRADE_MODES` in `market.utils.js` |
| **Custom SVG chart (report page)** | Recharts couldn't handle per-building colored series + diamond SoC markers. SVG gives full control. | New chart types → add new component, don't change EnergyChart |
| **Day-Ahead + Intraday split** | Day-Ahead: planned, cheaper (≥฿3.50). Intraday: instant, penalty price (≥฿4.00). Two distinct use-cases. | Market clearing logic is in `market.service.js` — don't duplicate |
| **2-VM deployment** | fullnode (221) runs backend+blockchain, webproxy (224) runs frontend. Compute3 is jump host + NAT. | Any new service → assign to the correct profile (`node` or `proxy`) |
| **`pull_policy: always` in docker-compose** | Ensures VMs auto-pull latest image without manual `docker pull`. | Don't remove unless you want manual pull |
| **compute3 as nginx reverse proxy** | VMs on 192.168.100.x aren't directly accessible from 10.10.161.x. compute3 bridges both networks. | If network changes, update `nginx` configs on compute3 |
| **Gmail SMTP for OTP** | Simple, no extra infra. App password required (not regular password). | If Gmail blocks, switch to SendGrid or SES |

---

## 2. 📐 Coding Standards & Architecture

### Backend Standards

#### File Structure
```
backend/
├── app.js                    # Express app (routes + direct endpoints)
├── server.js                 # Bootstrap
├── utils/prisma.js           # Prisma Proxy (AsyncLocalStorage — import this!)
├── features/
│   ├── {feature}/
│   │   ├── {feature}.routes.js      # Express router
│   │   ├── {feature}.controller.js  # Request handler
│   │   ├── {feature}.service.js     # Business logic
│   │   ├── {feature}.repository.js  # Data access (Prisma queries)
│   │   └── {feature}.model.js       # Alternative pattern (service+repo combined)
│   ├── users/         # Auth, OTP, registration
│   ├── billing/       # Invoices, receipts, purchases
│   ├── trading/       # Offers, bids, market matching
│   ├── energy/        # Meter registration, energy aggregation
│   ├── transactions/  # Transaction service + blockchain verification
│   └── wallets/       # Wallet operations
├── middleware/         # Auth, role validation
└── prisma/            # Prisma schema + migrations
```

#### Prisma Dual DB Pattern (CRITICAL)
```js
// ✅ CORRECT — Always import from proxy
const { prisma } = require('../../utils/prisma');

// ❌ WRONG — Never import PrismaClient directly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
```

The proxy uses `AsyncLocalStorage` to switch between `real` and `demo` databases per request. If called outside a request lifecycle (cron, background job), wrap in try-catch or pass prisma explicitly.

#### Field Name Rules (Common Pitfalls)
| Table | Correct Field | Wrong Field |
|-------|--------------|-------------|
| DailyEnergy, HourlyEnergy, WeeklyEnergy, MonthlyEnergy | `meterSnid` | `meterId` |
| DailyEnergy, HourlyEnergy, WeeklyEnergy, MonthlyEnergy | `kwh` (lowercase) | `kWH` |
| MeterInfo, RunningMeter | `kWH` (uppercase) | `kwh` |
| Transaction | `txid` (mapped from `id` column) | `id` |
| Transaction | `tokenAmount` (mapped from `amount` column) | `amount` |
| EnergyOffer | `ratePerkWH` | `ratePerKwh` |

#### Circular Dependency Prevention
Use lazy requires for dependencies that might cause circular imports:
```js
// ✅ CORRECT — inside function body
async function sellToBid(...) {
    const { verifyTransaction } = require('../transactions/transactionVerification.service');
    // ...
}

// ❌ WRONG — top-level require
const { verifyTransaction } = require('../transactions/transactionVerification.service');
```

#### Direct Endpoints in app.js
```js
GET /api/transactions
GET /api/transactions/blockchain/recent
GET /api/transactions/blockchain/tx/:txHash
GET /api/transactions/:id
GET /api/transactions/:id/verification-preview
```

### Frontend Standards

#### File Structure
```
frontend-vite/src/
├── pages/
│   ├── dashboard/dashboardHome.js    # Admin dashboard
│   ├── energy/meter.js               # Meter detail page
│   ├── energy/meterRegistration.js   # Register meter
│   ├── trading/market.js             # Energy marketplace
│   ├── trading/energySelling.js      # Sell/buy energy panel
│   ├── trading/mockEnergy.js         # Mock data generator
│   ├── billing/wallet.js             # Wallet top-up
│   └── ...
├── components/
│   ├── shared/energySellingPanel.js  # Reusable buy/sell panel
│   ├── TOR/TORSell.js                # TOR requirements
│   └── ...
├── core/data_connecter/              # API clients
│   ├── market.js
│   ├── purchase.js
│   ├── register.js
│   ├── wallet.js
│   ├── building.js
│   └── rate.js
├── global/          # Context providers
└── utils/           # Formatters, mappers
```

#### Component Naming
- Pages: `pascalCase.js` (e.g., `meterRegistration.js`)
- Components: `pascalCase.js` (e.g., `energySellingPanel.js`)
- Data Connectors: `snakeCase.js` (e.g., `purchase.js`)
- Utils: `camelCase.js` (e.g., `formatters.js`)

#### API Call Pattern
All API calls go through `core/data_connecter/` — never use axios directly in pages.
```js
import { purchaseEnergy } from '../../core/data_connecter/purchase';
const response = await purchaseEnergy({ offerId, buyerWalletId, targetBuildingId, amount });
```

---

### Market Logic: Day-Ahead & Intraday

The system has **two market types** for energy trading. Both use the same order book (`MarketOrder` table) but have different timing and pricing rules.

#### 🌅 Day-Ahead Market

| Property | Value |
|----------|-------|
| **Open** | 06:00 — 18:00 (submissions accepted) |
| **Lock** | 18:00 — submissions closed |
| **Clearing** | ~00:00 (midnight) — matching engine runs |
| **Baseline Price** | ฿3.50/kWh |
| **Bid Range** | ≥ ฿3.85/kWh (baseline + 10%) |
| **Offer Range** | < ฿4.00/kWh (below Intraday penalty) |

**Flow:**
1. Buildings submit bids (buy) or offers (sell) before 18:00
2. At midnight, `executeMarketClearing()` runs via cron
3. **Intra-Building matching** — Solar meter → Battery meter within same building (priority)
4. **Cross-Building matching** — Sort bids highest-to-lowest, offers lowest-to-highest
5. **Forced distribution** — Unsold energy from solar buildings is forcibly sold to buildings with lowest battery kWh
6. Creates `MarketRun` + `MarketMatch` records

#### ⚡ Intraday Market

| Property | Value |
|----------|-------|
| **Status** | Always open (real-time) |
| **Min Rate** | ฿4.00/kWh (penalty price) — higher than Day-Ahead |
| **Execution** | Instant — peer-to-peer manual selling |

**Flow:**
1. Sellers create offers at any time with rate ≥ ฿4.00/kWh
2. Buyers browse available offers in the Marketplace UI
3. On purchase: tokens transferred, invoice + receipt created, battery meter updated
4. Higher price compensates for lack of advance planning

#### 🔄 Auto-Trade Mode (4 Combinations)

Each building has two independent trade modes: **Solar mode** (for produced energy) and **Battery mode** (for storage). These combine to 4 configurations defined in `trade.engine.js`:

| Solar Mode | Battery Mode | Behavior |
|------------|-------------|----------|
| `AUTO_BATTERY_THRESHOLD` | `AUTO_BATTERY_THRESHOLD` | Full auto-trade. Solar: split by `solarSelfPercent` (default 80% self, 20% sell). Battery: sell above `batterySellThreshold` (default 80%), auto-buy below. |
| `AUTO_BATTERY_THRESHOLD` | `SELF_CONSUME` | Solar surplus → charge battery first (free), remaining → market sell. Battery never trades externally. |
| `SELF_CONSUME` | `AUTO_BATTERY_THRESHOLD` | All solar → self-consume + charge battery. Battery auto-buys from market when below threshold, but never sells solar. |
| `MANUAL` | `MANUAL` | Manual only. No automated offers or bids. User must manually create offers/bids. |

**Solar surplus flow (AUTO_BATTERY_THRESHOLD):**
```
solarSelfPercent = 80 (configurable per building)
Produced 100 kWh → 80 kWh self-consume, 20 kWh sellable
     ↓
If battery mode = SELF_CONSUME → charge battery first (free storage!)
     ↓
Remaining → auto-create Intraday offer at solarOfferPrice
```

**Battery threshold flow (AUTO_BATTERY_THRESHOLD):**
```
batterySellThreshold = 80% (configurable)
Battery capacity 100 kWh, current 90 kWh
     ↓
Above threshold? 90 > 80 → sellable = 90 - 80 = 10 kWh
     ↓
auto-create Intraday offer at batteryOfferPrice
     ↓
If below threshold → auto-create Intraday bid at batteryBidPrice
```

#### 📊 Matching Priority (Day-Ahead Clearing)

```
1. Same-building solar → battery (free transfer, highest priority)
2. Highest bid price ↓
3. Lowest battery kWh (most urgent need)
4. Unsold solar → force-sell to top consumer
```

---

## 2.5 🎛️ Mode Configuration System

Each building has **two independent trade modes**: **Solar/Produce mode** and **Battery/Storage mode**, stored in the `Building` table.

### Database Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tradeMode` | String | `MANUAL` | Legacy single mode. Used as fallback when per-asset modes are null |
| `solarTradeMode` | String? | null | Overrides `tradeMode` for solar/produce meters |
| `batteryTradeMode` | String? | null | Overrides `tradeMode` for battery/storage meters |
| `batterySellThreshold` | Float | `80` | Emergency Reserve (Min SoC). Battery auto-sells above this, auto-buys below |
| `solarSelfPercent` | Float? | `80` | % of solar yield consumed locally (rest is sold to market) |
| `solarOfferPrice` | Float? | null | Fixed price for solar auto-offers (falls back to market rate) |
| `batteryOfferPrice` | Float? | null | Fixed price for battery auto-sell offers |
| `batteryBidPrice` | Float? | null | Max price willing to pay to charge battery from market |

### Mode Options (3 values)

| Value | Icon | Behavior |
|-------|------|----------|
| `SELF_CONSUME` | 🏠 | All energy consumed locally. No market participation |
| `MANUAL` | ✋ | User manually creates offers/bids via UI. No automation |
| `AUTO_BATTERY_THRESHOLD` | 🤖 | Auto-trade based on thresholds. Solar: split by `solarSelfPercent`. Battery: sell above `batterySellThreshold`, buy below |

### 4 Mode Combinations

| Solar Mode | Battery Mode | Behavior |
|------------|-------------|----------|
| `AUTO_BATTERY_THRESHOLD` | `AUTO_BATTERY_THRESHOLD` | Full auto-trade |
| `AUTO_BATTERY_THRESHOLD` | `SELF_CONSUME` | Solar sells surplus, battery only local |
| `SELF_CONSUME` | `AUTO_BATTERY_THRESHOLD` | All solar → self-consume + charge battery. Battery auto-trades |
| `MANUAL` | `MANUAL` | Manual only |

### API

```
PUT /api/buildings/:id   Body: { tradeMode, solarTradeMode, batteryTradeMode, batterySellThreshold, ... }
```

---

## 2.6 🧩 EnergySellingPanel Component API

The `EnergySellingPanel` (`frontend-vite/src/components/shared/energySellingPanel.js`) is the main panel used by `energySelling.js`. It has two tabs:
- **☀️ Solar Array** — controls `tradeMode` (syncs to parent state via `setTradeMode`)
- **🔋 Storage System** — controls `storageMode` (local state, NOT synced to parent)

### Key Props

| Prop | Type | Description |
|------|------|-------------|
| `showTradePolicyControls` | bool | Shows/hides the policy settings section |
| `tradeMode` | string | Current mode (MANUAL/SELF_CONSUME/AUTO_BATTERY_THRESHOLD) |
| `setTradeMode` | fn | Updates parent tradeMode state (Solar Array only) |
| `batterySellThreshold` | string | Emergency Reserve % from parent |
| `setBatterySellThreshold` | fn | Updates parent batterySellThreshold |
| `onSaveTradePolicy` | fn | Calls `updateBuilding()` in parent (`energySelling.js`) |
| `unsavedTradeMode` | bool | Shows unsaved indicator when mode changed |
| `isSavingTradePolicy` | bool | Loading state during save |
| `canManualSell` | bool | Controls if manual sell/buy buttons are enabled |
| `sourceEnergyStatus` | object | `{ produce: {current,capacity,percentage}, battery: {...} }` |
| `marketSnapshot` | object | Current market state (producedKwh, consumedKwh, netKwh, marketPrice, orderBook) |

### Internal State (not synced to backend)
- `storageMode` — Battery mode selection (local only)
- `storageBuyTrigger` — Price threshold to auto-buy
- `storageSellTrigger` — Price threshold to auto-sell
- `storageReserveMin` — Emergency Reserve slider (local only)

### Save Flow
```
energySelling.js handleSaveTradePolicy()
  → updateBuilding(id, { tradeMode, batterySellThreshold })
  → Updates selectedBuilding + realBuildings state
```

---

## 2.7 🖥️ Report Page — EnergyChart Component

The report page (`frontend-vite/src/pages/energy/report.js`) uses a **custom SVG chart** (not Recharts) for the energy comparison graph.

### Component Signature
```jsx
<EnergyChart
  data={chartData}                          // Aggregated view data array
  series={[]}                               // Per-building view array
  showBattery={true}
  showProduce={true}                        // Toggle: show production line
  showConsume={true}                        // Toggle: show consumption line
  showSoC={true}                            // Toggle: show battery SoC line
/>
```

### Data Format
```js
{ day: 'May 25', pvProduction: 1234, consumption: 567, batterySoC: 85 }
```

### Visual Styles

| Series | Aggregated View | Per-Building View |
|--------|----------------|-------------------|
| **Produce** | Solid green `#22c55e`, fill `rgba(34,197,94,0.1)` | Solid building color |
| **Consume** | Solid red `#ef4444` | Dashed building color `6,3` |
| **SoC** | Dotted orange `#f97316` `1,6` + fill band | Dotted building color `1,6` |
| **SoC dots** | Diamond shape (polygon) | Diamond shape (polygon) |

### Y-Axis
- **Left**: Energy (kWH) — auto-scaled to data max (rounded to nearest 100)
- **Right**: State of Charge (SoC) (%) — aggregated: 45-70 range, per-building: 0-100 range

### Toggle Filters
Three toggle buttons (Produce / Consume / State of Charge) control visibility of each series in both chart and legend. Hidden series have `opacity-30` in legend.

---

## 2.8 🔋 Battery SoC Logic (Report Page)

The SoC in the per-building chart uses **forward accumulation from earliest data**:

```js
// 1. Query battery flow from far-past date (2024-01-01)
const batFlowRes = await searchBuildingEnergy({ start: '2024-01-01', end, timeunit: 'day' });

// 2. Forward accumulate from 0%
let soc = 0;
const fullMap = {};  // { '2026-05-25': 85 }
for (each date in chronological order) {
  soc += (flowKwh / batteryCapacity) * 100;
  soc = Math.min(100, Math.max(0, soc));  // Cap at 0-100%
  fullMap[dateString] = Math.round(soc);
}

// 3. Map accumulated SoC to chart labels by date
batterySoCSeries = labels.map((label) => {
  // label = 'May 25' → try year 2026, then 2025 → '2026-05-25'
  return fullMap[key] ?? null;
});
```

### Key Rules
- **Cap at 100%**: Both `batteryPct` and `soc` are capped with `Math.min(100, Math.max(0, ...))`
- **Far-past query**: Uses `2024-01-01` to get complete accumulation history
- **Date mapping**: Labels are `MMM DD` format, matched to `YYYY-MM-DD` keys in fullMap (tries current year first, then previous year)
- **Aggregated view**: Uses `averageBatteryPct` = average of all buildings' current battery %

---

## 2.9 🏗️ Building Name Normalization Rules

Backend uses `LOWER()` for building name matching in SQL queries. Some buildings have historical name mismatches that require normalization:

```js
const normalizeBackendBuildingName = (name) => {
    const bname = (name||'').toString().toLowerCase().replace(/\s+/g, '');
    if (bname === 'nidasumpan') return 'nidasumpun';  // "Nida Sumpan" → "nidasumpun"
    if (bname === 'narathip') return 'naradhip';        // "Narathip" → "naradhip"
    return (name || '').toString().trim();
};
```

> ⚠️ When querying by `buildingId` directly (via `searchBuildingEnergy` with `buildingId` param), the backend resolves the exact name from the DB — bypassing the need for normalization.

---

## 2.10 📊 Energy Analytics Utilities

Defined in `frontend-vite/src/utils/energyAnalytics.js`:

| Function | Description |
|----------|-------------|
| `toNumeric(value)` | Safe number conversion — returns 0 for null/undefined/NaN |
| `formatDateLocal(date)` | Formats Date to `YYYY-MM-DD` string |
| `getLatestMeterDate(data)` | Gets the latest timestamp from meter data array |
| `buildThreeHourSeries(data)` | Aggregates hourly data into 3-hour buckets |

### Export Functions (Report Page)
- `exportCurrentReport` — Generates CSV/Excel with all building data
- `exportCurrentPdf` — Generates PDF report
- `downloadBlobFile(content, filename, mimeType)` — Utility for blob downloads

---

## 2.11 🧮 SVG Chart Helper Functions

```js
// Generate SVG arc path for donut charts
const describeArc = (cx, cy, radius, startAngle, endAngle) => { ... }

// Generate diamond points for SoC data markers
const diamondPoints = (cx, cy, size) => `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;

// Polar to cartesian conversion
const polarToCartesian = (cx, cy, radius, angleInDegrees) => { ... }
```

---

## 2.12 ⏰ Cron Jobs & Background Processes

> For AI: These run on the fullnode VM. If you add a new cron job, register it in the appropriate service file.

| Job | Schedule | File | What It Does |
|-----|----------|------|-------------|
| **Mock Energy Generator** | Every hour (`0 * * * *`) | `backend/features/energy/energyAggregation.js` | Generates mock meter readings for demo/testing when no real IoT data |
| **Auto-Trade Engine** | 15:00 daily | `backend/features/trading/trade.engine.js` | Checks all buildings' solar/battery modes, auto-creates offers/bids based on thresholds. Runs **before** Day-Ahead lock (18:00). |
| **Day-Ahead Market Clearing** | ~00:00 daily (midnight) | `backend/features/trading/market.service.js` | Executes `executeMarketClearing()` — matches bids/offers, creates MarketRun + MarketMatch records, generates invoices+receipts |

### Auto-Trade Engine Flow
```
15:00 trigger → for each building:
  if solarTradeMode == AUTO_BATTERY_THRESHOLD:
    calculate surplus = produce * (1 - solarSelfPercent/100)
    if surplus > 0 → auto-create Intraday offer at solarOfferPrice
  
  if batteryTradeMode == AUTO_BATTERY_THRESHOLD:
    if batterySoC > batterySellThreshold:
      sellable = currentKwh - (capacity * batterySellThreshold/100)
      auto-create Intraday offer at batteryOfferPrice
    else:
      deficit = (capacity * batterySellThreshold/100) - currentKwh
      auto-create Intraday bid at batteryBidPrice
```

---

## 2.13 🧪 Test Data & Seed Accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Admin** | `admin@nida.com` | `admin123` | Full access to all features |
| **User (Building)** | Varies | Set during register | Each building has its own user account |

### Test Buildings
| Name | ID (DB) | Has Solar? | Has Battery? | Default Mode |
|------|---------|-----------|-------------|-------------|
| นิด้า สรรพคุณ (Nida Sumpun) | 1 | ✅ | ✅ | MANUAL |
| นรา ทิพย์ (Naradhip) | 2 | ✅ | ✅ | MANUAL |
| นิด้า บางซื่อ (Nida Bangsue) | 3 | ✅ | ✅ | MANUAL |
| สรรพคุณ 2 (Sumpun 2) | 4 | ✅ | ✅ | MANUAL |
| ทราย ฟ้า (Sai Fa) | 5 | ✅ | ✅ | MANUAL |

> ⚠️ **Building Name Normalization**: `nidasumpan` → `nidasumpun`, `narathip` → `naradhip` (see section 2.9)

---

## 2.14 🤖 AI Prompt Patterns (How to Ask for Code Generation)

> For AI: Use these templates when the user asks for common tasks. This ensures consistency.

### Pattern 1: New Backend Feature (API Endpoint)
```
User asks: "Add a [GET/POST/PUT/DELETE] endpoint for [resource]"
1. Create router in /features/{feature}/{feature}.routes.js (or add to existing)
2. Create/hook controller in /features/{feature}/{feature}.controller.js
3. Create/hook service in /features/{feature}/{feature}.service.js
4. Create/hook repository in /features/{feature}/{feature}.repository.js (use prisma proxy)
5. Register router in /backend/app.js
6. Create data connector in frontend-vite/src/core/data_connecter/{name}.js
```

### Pattern 2: New Frontend Page
```
User asks: "Create a new page for [feature]"
1. Create page in /frontend-vite/src/pages/{category}/{pageName}.js
2. If reusable component needed, add to /frontend-vite/src/components/shared/
3. Add route in App.jsx or navigation menu
4. Use existing data connectors from /frontend-vite/src/core/data_connecter/
5. NEVER use axios directly — always go through data_connecter
```

### Pattern 3: Modify Trade Logic
```
User asks: "Change how [solar/battery] auto-trading works"
1. Edit backend/features/trading/trade.engine.js (the cron-triggered logic)
2. If new mode needed, add to TRADE_MODES in market.utils.js
3. Building fields (solarTradeMode, batteryTradeMode, etc.) in schema.prisma
4. UI changes in energySellingPanel.js or energySelling.js
```

### Pattern 4: Deployment
```
User asks: "Deploy to VMs"
Local machine (PowerShell):
  docker compose build backend --no-cache
  docker compose build frontend --no-cache
  docker push diaboliccz/nida-backend:latest
  docker push diaboliccz/nida-frontend:latest

Fullnode VM (192.168.100.221):
  sudo COMPOSE_PROFILES=node docker compose up -d --force-recreate backend

Webproxy VM (192.168.100.224):
  sudo COMPOSE_PROFILES=proxy docker compose up -d --force-recreate frontend
```

---

## 2.15 🔄 Request Lifecycle (Middleware Chain)

> For AI: Every API request passes through this chain. Know this before adding new middleware or routes.

```
Incoming Request
  │
  ▼
1️⃣ cors({ origin: FRONTEND_URL, credentials: true })
  │
  ▼
2️⃣ express.json({ limit: '25mb' })
  │
  ▼
3️⃣ express.urlencoded({ extended: true })
  │
  ▼
4️⃣ dataModeMiddleware
     ├── Reads DEFAULT_DATA_MODE from env
     ├── Checks x-data-mode header (demo/real)
     └── Sets AsyncLocalStorage context → prisma proxy switches DB
  │
  ▼
5️⃣ authMiddleware (if route requires authentication)
     ├── Validates JWT/session token
     └── Attaches user info to req.user
  │
  ▼
6️⃣ Router → Controller → Service → Repository (prisma proxy)
  │
  ▼
7️⃣ Response (JSON)
```

### Response Format
```js
// ✅ Success
{ "success": true, "data": { ... } }

// ✅ Success with list (paginated or simple array)
{ "success": true, "data": [ ... ] }

// ❌ Error (HTTP 4xx)
{ "error": "Human-readable error message" }

// ❌ Server Error (HTTP 5xx)
{ "error": "Technical error details (stack trace in dev)" }
```

> All routes use `asyncHandler` wrapper to catch async errors and pass to Express error handler.

---

## 2.16 🗺️ Frontend Routing Structure

> For AI: Know this before adding new pages or modifying navigation.

```
/                       → Redirect to /dashboard
/login                  → Login page (auth)
/register               → Register page (OTP verification)
/dashboard              → dashboardHome.js
/energy/report          → report.js          (EnergyChart + analytics)
/energy/meter           → meter.js           (Single meter detail)
/energy/meter-register  → meterRegistration.js
/trading/market         → market.js          (Marketplace: offers/bids)
/trading/energy-selling → energySelling.js   (Trade mode config + manual sell)
/trading/mock-energy    → mockEnergy.js      (Mock data generator)
/billing/wallet         → wallet.js          (Wallet + top-up)
/billing/receipts       → receipts.js        (Invoice/receipt list)
/billing/invoices       → invoices.js        (Invoice management)
```

---

## 2.17 🔗 Blockchain Verification Flow

> For AI: Understand this before working with transactions or blockchain features.

```
1. Transaction created in DB (table: Transaction)
   ├── txid (UUID) ← mapped from "id" column
   ├── txHash (string) ← blockchain transaction hash
   └── walletId, tokenAmount, type, status

2. Invoice + Receipt created (for marketplace purchases)
   ├── Invoice: buildingName, fromWId, toWId, kWH, status
   └── Receipt: invoiceId (FK → Invoice) → one-to-one

3. BlockTransaction record created
   ├── txHash (unique)
   └── receiptId (FK → Receipt)

4. Verification (via direct endpoints in app.js)
   ├── GET /api/transactions/blockchain/recent → recent verified txs
   ├── GET /api/transactions/blockchain/tx/:txHash → single tx verification
   └── GET /api/transactions/:id/verification-preview → preview before verify
```

> ⚠️ **Lazy require**: Transaction Verification service uses lazy require to avoid circular deps.

---

## 2.18 📧 Email Flow (OTP)

> For AI: Used for user registration. Gmail SMTP with App Password.

```
POST /api/users/request-otp  { email, building_name }
  → Generate 6-digit OTP
  → Store in DB (OTP table)
  → Send via Nodemailer (Gmail SMTP)
  → Response: { success: true, message: "OTP sent" }

POST /api/users/verify-otp   { email, otp }
  → Check OTP validity + expiry
  → Register user + create building + wallet
  → Response: { success: true, data: { user, token } }
```

### SMTP Config (in .env)
```
GMAIL_USER=dominolity@gmail.com
GMAIL_PASS=bcvbniydwlmqupsd   ← App Password (not regular password!)
```

> ⚠️ **Common Issue**: Gmail App Password expires. If `500 on request-otp`, generate new one at https://myaccount.google.com/apppasswords

---

## 2.19 📊 IoT Data Flow (Meter → Database)

> For AI: Understand this before working with energy aggregation or meter data.

```
RunningMeter (real-time, per minute)
  snid | timestamp | kW | kWH
  │
  ▼ (cron: energyAggregation.js, every hour)
  │
  HourlyEnergy (h0-h23 per day)
  meterSnid | date | h0 | h1 | ... | h23 | kwh
  │
  ▼ (cron: daily aggregation)
  │
  DailyEnergy (d1-d31 per month)
  meterSnid | year | month | d1 | d2 | ... | d31 | kwh
  │
  ▼ (cron: weekly aggregation)
  │
  WeeklyEnergy (sun-sat per week)
  meterSnid | year | week | sun | mon | ... | sat | kwh
  │
  ▼ (cron: monthly aggregation)
  │
  MonthlyEnergy (M1-M12 per year)
  meterSnid | year | M1 | M2 | ... | M12 | kwh
```

### Field Name Rules (CRITICAL)
| Table | Energy Field | ID Field |
|-------|-------------|----------|
| RunningMeter | `kWH` (uppercase) | `snid` |
| HourlyEnergy | `kwh` (lowercase) | `meterSnid` |
| DailyEnergy | `kwh` (lowercase) | `meterSnid` |
| WeeklyEnergy | `kwh` (lowercase) | `meterSnid` |
| MonthlyEnergy | `kwh` (lowercase) | `meterSnid` |
| MeterInfo | `kWH` (uppercase) | `snid` (PK) |

---

## 2.20 🎨 Frontend State Management

> For AI: Know this before adding new features that need shared state across components.

### Tech Stack
- **Framework**: Redux Toolkit + redux-persist
- **Persistence**: Stored in localStorage under key `root`
- **Async**: redux-thunk for async actions
- **Provider**: Wrapped via `<Provider store={store}>` in `Routes.js`

### Store Structure
```
store/
├── index.js            # configureStore + redux-persist setup
├── auth/
│   ├── auth.action.js  # Login, logout, session management
│   ├── auth.reducer.js # Auth state (user, token, loading)
│   └── auth.types.js   # Action type constants
└── member/
    ├── member.action.js
    ├── member.reducer.js
    └── member.types.js
```

### Usage Pattern
```js
// ✅ Reading state
const { user, token } = useSelector(state => state.auth);

// ✅ Dispatching actions
import { login, logout } from '../../store/auth/auth.action';
dispatch(login({ email, password }));
```

### Global Constants (localStorage keys)
Defined in `frontend-vite/src/global/key.js`:
```js
Token = 'token', UserId = 'userid', UserEmail = 'useremail', UserRole = 'userrole'
```

---

## 2.21 🔐 Auth & Token Flow

> For AI: Understand this before working with login, registration, or protected routes.

### Login Flow
```
POST /api/users/login  { email, password }
  → Response: { success: true, data: { token, user } }
  → Frontend calls storeSession(response)
  → Token saved to localStorage
  → Axios interceptor auto-adds header: Authorization: Bearer {token}
  → Redirect to /dashboard
```

### Axios Setup (api_caller.js)
```
Request Interceptor:
  → Reads token from localStorage
  → Sets headers.Authorization = `Bearer ${token}`

Response Interceptor:
  → If 401 → clearSession() → redirect to /login
```

### Session Actions
| Action | Function | What It Does |
|--------|----------|-------------|
| **Login** | `storeSession(data)` | Saves token, userId, email, role to localStorage + Redux |
| **Logout** | `clearSession()` | Clears localStorage + Redux state → redirect /login |
| **Auto-login** | On app mount | Reads token from localStorage, validates, sets Redux state |

### Protected Routes
Routes that require auth check for token in Redux/localeStorage before rendering.

---

## 2.22 ⚠️ Frontend Error Handling

> For AI: Use these patterns for consistent error UX.

### Global Pattern: Ant Design Notification
```js
import { notification } from 'antd';

// ✅ Success
notification.success({ message: 'Success', description: 'Operation completed' });

// ✅ Error
notification.error({ message: 'Error', description: err.response?.data?.error || 'Something went wrong' });
```
- Used in: `auth.action.js`, most pages after API calls
- `description` is optional, often shows API error message

### Local Pattern: Toast State (Simple Pages)
```js
const [toast, setToast] = useState({ type: '', message: '' });

// Auto-dismiss after 3 seconds
useEffect(() => {
  if (toast.message) setTimeout(() => setToast({ type: '', message: '' }), 3000);
}, [toast]);
```

### API Error Handling Pattern
```js
try {
  const res = await someApiCall();
  // handle success
} catch (err) {
  notification.error({
    message: 'Error Title',
    description: err.response?.data?.error || err.message
  });
}
```

> ✅ Always check `err.response?.data?.error` first for backend error messages.

---

## 2.23 📡 Real-time Updates (Polling)

> For AI: These components use `setInterval` for auto-refresh. Don't add new polling without checking existing intervals.

| Component | Interval | What It Polls | File |
|-----------|----------|--------------|------|
| **NotificationBell** | Every 15s | Unread notifications count | `components/NotificationBell.js` |
| **Receipts Page** | Every 15s (`POLL_INTERVAL`) | Receipt list (auto-refresh) | `pages/billing/receipts.js` |
| **MarketTimeline** | Every 60s | Day-Ahead market countdown | `components/shared/MarketTimeline.js` |
| **Demo Flow** | Every 3s | Mock energy data (when enabled) | `pages/demo/DemoFlow.js` |

### Pattern (Receipts Page Example)
```js
const POLL_INTERVAL = 15000; // 15 seconds
const [autoRefresh, setAutoRefresh] = useState(true);

useEffect(() => {
  if (!autoRefresh) return;
  fetchReceipts(); // initial fetch
  const id = setInterval(fetchReceipts, POLL_INTERVAL);
  return () => clearInterval(id);
}, [autoRefresh]);
```

---

## 2.24 📅 Date/Time Handling

> For AI: Use these libraries and formats for consistency.

### Libraries
| Library | Usage | Where |
|---------|-------|-------|
| **dayjs** | Primary date math/formatting | `trading/mockEnergy.js`, general usage |
| **moment** | Thai locale only (`moment/locale/th`) | `Routes.js` |
| **Native Date** | Fallback for simple formatting | Various pages |

### Formats Used
```js
// Display format
date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
// → "25 May 2026"

// API format (YYYY-MM-DD)
formatDateLocal(date)  // defined in utils/energyAnalytics.js
// → "2026-05-25"

// SoC chart labels
// "May 25" format → matched to "YYYY-MM-DD" keys
```

### Utility Functions (`utils/energyAnalytics.js`)
| Function | Description |
|----------|-------------|
| `toNumeric(value)` | Safe number conversion → 0 for null/NaN |
| `formatDateLocal(date)` | Formats Date to `YYYY-MM-DD` |
| `getLatestMeterDate(data)` | Gets latest timestamp from meter data |
| `buildThreeHourSeries(data)` | Aggregates hourly data into 3-hour buckets |

---

## 2.25 🌐 i18n / Language Support

> For AI: The app has PARTIAL Thai support. No full i18n framework.

### What's Supported
- **Ant Design locale**: Thai — configured via `<ConfigProvider locale={locale}>` in `Routes.js`
- **Moment locale**: Thai — imported `moment/locale/th`
- **UI strings**: Hard-coded in **English** throughout all components

### Limitations
- ❌ No i18n framework (react-i18next, react-intl, etc.)
- ❌ No language switcher
- ❌ UI labels/buttons/text are all hard-coded English

### If Adding Thai Translation
```js
// Pattern to follow (if implementing i18n in future):
// import { useTranslation } from 'react-i18next';
// const { t } = useTranslation();
// <Button>{t('common.save')}</Button>
```

---

## 3. 🗺️ Key File Map

### Essential Files to Read First

| File | Why It Matters |
|------|---------------|
| `frontend-vite/src/pages/energy/report.js` | Report page — EnergyChart SVG, battery SoC accumulation, chart toggles |
| `frontend-vite/src/components/shared/energySellingPanel.js` | Trading panel — Solar Array + Storage System mode config UI |
| `frontend-vite/src/pages/trading/energySelling.js` | Energy selling page — trade mode save handler, building panel |
| `frontend-vite/src/utils/energyAnalytics.js` | Utility functions (toNumeric, formatDateLocal, buildThreeHourSeries) |
| `backend/features/trading/trade.engine.js` | Auto-trade execution engine (cron: 15:00 daily) |
| `backend/features/building/building.model.js` | Building CRUD — mode validation (tradeMode, batteryTradeMode, etc.) |
| `backend/features/trading/market.utils.js` | TRADE_MODES constants + normalizeTradeMode helper |
| `backend/app.js` | Main entry — route mounting + direct endpoints |
| `backend/utils/prisma.js` | Prisma Proxy implementation (AsyncLocalStorage) |
| `backend/features/trading/offer.repository.js` | Core offer/bid CRUD + purchase logic |
| `backend/features/billing/invoice.service.js` | Invoice generation, purchase marketplace energy |
| `backend/features/energy/energyAggregation.js` | RunningMeter → Daily/Weekly/Monthly aggregation |
| `backend/features/transactions/transactionVerification.service.js` | Blockchain verification (lazy require pattern) |
| `frontend-vite/src/pages/trading/market.js` | Marketplace UI — offers, bids, purchase flow |
| `database/schema.prisma` | Full database schema |
| `docker-compose.yml` | Production deployment config |
| `.env` | Environment variables |
| `frontend-vite/nginx.conf` | Frontend nginx config |

---

## 4. ⚡ Deployment Guide

### Docker Compose Profiles
- `data` — database VM: `db`, `pgadmin`, `prisma`
- `node` — fullnode VM: `blockchain`, `backend`
- `proxy` — webproxy VM: `frontend`

### Build & Deploy Flow
```powershell
docker compose build backend --no-cache
docker push diaboliccz/nida-backend:latest
# On VM:
sudo docker pull diaboliccz/nida-backend:latest
sudo COMPOSE_PROFILES=node docker compose up -d --force-recreate backend
```

### Compute3 Recovery (After Reboot)

When compute3 restarts, you must re-apply:
```bash
# 1. Re-add secondary IP (not persistent across reboot)
sudo ip addr add 10.10.161.224/24 dev brqc1bfef02-90

# 2. Re-add iptables rules (not persistent)
sudo iptables -t nat -A PREROUTING -d 10.10.161.224 -p tcp --dport 80 -j DNAT --to-destination 192.168.100.224:80

# 3. Restart nginx
sudo systemctl restart nginx
```

> 💡 **To make iptables persistent**: `sudo apt install iptables-persistent && sudo netfilter-persistent save`

### Critical: `--force-recreate` vs `--no-deps`
- ✅ `--force-recreate` — When env vars changed (re-reads .env)
- ✅ `--no-deps` — When only code changed (faster restart)

### Image Transfer (when VM can't pull from Docker Hub)
```powershell
docker save diaboliccz/nida-backend:latest -o nida-backend.tar
scp -i "C:\path\to\key.pem" nida-backend.tar ubuntu@192.168.100.221:~
# On VM:
sudo docker load -i nida-backend.tar
sudo COMPOSE_PROFILES=node docker compose up -d --force-recreate backend
```

### Important: Env Var Propagation
If you add a new env var to `.env`, it **must** also be added to `docker-compose.yml` under the service's `environment:` block.

---

## 5. 🔧 Common Issues & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `prisma is not defined` | AsyncLocalStorage has no active context | Wrap in try-catch, pass prisma explicitly |
| `500 on request-otp` | Gmail SMTP 535 (App Password expired) | Generate new at https://myaccount.google.com/apppasswords |
| Transaction page hangs / shows 0 | Circular dependency tx ↔ verif service | Use direct endpoints in app.js |
| `Invalid offer ID` / `Offer not found` | UUID string vs Int ID mismatch | Backend uses parseInt + raw SQL fallback |
| `Cannot read properties of null (reading 'status')` | `.filter(Boolean)` on wrong array | Place filter outside `Promise.all()` |
| Docker ignores .env changes | Cached container env vars | Use `--force-recreate` |
| Frontend build 440MB | `context: .` sends entire repo | Use `context: ./frontend-vite` |
| SoC exceeds 100% | `batteryPct` not capped | Add `Math.min(100, Math.max(0, ...))` to calculation |
| Storage mode not saving | `storageMode` is local state in EnergySellingPanel | Must sync `batteryTradeMode` to parent and save via `onSaveTradePolicy` |
| SoC chart shows 0→4% for 7-day view | Date mapping picks wrong year | Label `May 25` → try `2026-05-25` first, then `2025-05-25` |
| Building name not matching DB | Space in "Nida Sumpan" breaks LOWER() | Use `buildingId` param or normalize spaces |

---

## 5.5 🚫 Anti-Patterns & Gotchas (For AI)

> ⚠️ **CRITICAL**: These are mistakes the AI should NEVER make. Read before generating any code.

### ❌ NEVER Do These
1. **❌ Import PrismaClient directly** — Always use `const { prisma } = require('../../utils/prisma')`
2. **❌ Use `&&` in PowerShell terminal commands** — Use `;` instead
3. **❌ Use axios directly in frontend pages** — Always go through `core/data_connecter/`
4. **❌ Edit `report.js` EnergyChart for new chart types** — Create new component instead
5. **❌ Store `storageMode`/`storageBuyTrigger` in backend** — These are UI-only local state
6. **❌ Use `kWH` (uppercase) on DailyEnergy/HourlyEnergy tables** — Field is `kwh` (lowercase)
7. **❌ Use `meterId` on DailyEnergy/HourlyEnergy tables** — Field is `meterSnid`
8. **❌ Mix real/demo database in same request** — The proxy handles this via middleware

### ⚠️ Always Remember
1. **✅ Circular deps?** → Use lazy `require()` inside function body, not top-level
2. **✅ AsyncLocalStorage outside request?** → Wrap in try-catch or pass prisma explicitly
3. **✅ batteryPct / soc** → Always cap with `Math.min(100, Math.max(0, value))`
4. **✅ SoC date mapping** → Try current year first, then previous year
5. **✅ Building name query** → Use `buildingId` param to bypass name normalization
6. **✅ New env var** → Add to both `.env` AND `docker-compose.yml` `environment:` block
7. **✅ Network request from browser** → Must go through 10.10.161.x (can't reach 192.168.100.x directly)

---

## 6. 🧠 Inference Settings (For Local Model Deployment)

| Setting | Recommendation |
|---------|---------------|
| **Context Window** | Minimum **128K tokens**, recommended **384K** for full codebase reasoning |
| **Temperature** | 0.2 — 0.5 (lower for code generation) |
| **Top-p** | 0.9 |
| **Max Output Tokens** | 8192+ |
| **System Prompt** | Include `@DEEPSEEK.md` or load this file as system context |

> 💡 Reference this file via `@DEEPSEEK.md` to provide full project context in a single reference.

---

## 7. 🧩 Database Schema (Quick Reference)

```sql
-- User: credId (UUID, unique), email (PK), role (USER|ADMIN)
-- Building: id (Int PK, autoincrement), name (unique), email (FK→User), tradeMode
-- MeterInfo: snid (PK), buildingName (FK→Building), type, kWH, approveStatus
-- Wallet: id (String PK), email (unique), tokenBalance (Float)
-- EnergyOffer: id (Int PK autoincrement), sellerWalletId, kWH, ratePerkWH, status (AVAILABLE|BOUGHT|CANCELLED|SOLD)
-- ⚠️ Actual DB has UUID strings — not autoincrement Int
-- EnergyBid: id (Int PK autoincrement), buyerWalletId, kWH, ratePerkWH, status (OPEN|FULFILLED|CANCELLED)
-- Transaction: txid (UUID PK @map "id"), walletId, type, tokenAmount (@map "amount"), status, txHash
-- Invoice: id (UUID PK), buildingName, fromWId, toWId, kWH, status (paid|late|cancelled)
-- Receipt: id (UUID PK), invoiceId (FK→Invoice, unique)
-- BlockTransaction: id (UUID PK), txHash (unique), receiptId
-- Battery: snid (unique), capacitykWH, currentkWH, buildingId, ownerId
-- MarketOrder: id (UUID PK), side (BID|OFFER), marketType, quantity, filled, price, status
-- MarketMatch: id (UUID PK), buyerOrderId, sellerOrderId, quantity, price
-- MarketRun: id (UUID PK), marketType, runTime, status
-- RunningMeter: snid, timestamp, kW, kWH — @@unique([snid, timestamp])
-- HourlyEnergy: meterSnid+date (PK), h0-h23, kwh
-- DailyEnergy: meterSnid+year+month (PK), d1-d31, kwh
-- WeeklyEnergy: meterSnid+year+week (PK), sun-sat, kwh
-- MonthlyEnergy: meterSnid+year (PK), M1-M12, kwh
```
