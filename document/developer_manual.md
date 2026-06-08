# NIDA Smart Grid — คู่มือนักพัฒนา (Developer Guide)

> เอกสารนี้จะพาเดินดูทุก folder และไฟล์สำคัญในโปรเจคทีละส่วน  
> เวลาต้องการแก้ไขอะไร → เปิดสารบัญ → กระโดดไป section นั้น → อ่านว่าไฟล์ไหนทำอะไร

---

## สารบัญ

- [โครงสร้างระดับบน](#โครงสร้างระดับบน)
- [Frontend (`frontend-vite/`)](#frontend-frontend-vite)
  - [Pages — หน้าทั้งหมดของแอป](#pages--หน้าทั้งหมดของแอป)
  - [Components — ชิ้นส่วน UI ที่ใช้ซ้ำ](#components--ชิ้นส่วน-ui-ที่ใช้ซ้ำ)
  - [Data Connectors — ตัวเชื่อม API](#data-connectors--ตัวเชื่อม-api)
  - [Store (Redux) — จัดการ state ทั้งแอป](#store-redux--จัดการ-state-ทั้งแอป)
  - [Utils & Global](#utils--global)
- [Backend (`backend/`)](#backend-backend)
  - [Entry Points](#entry-points)
  - [Features — แต่ละ feature แยก folder](#features--แต่ละ-feature-แยก-folder)
  - [Middleware](#middleware)
  - [Prisma Proxy (สำคัญที่สุด!)](#prisma-proxy-สำคัญที่สุด)
- [Database Schema](#database-schema)
- [กฎเหล็กที่ต้องจำ](#กฎเหล็กที่ต้องจำ)
- [Test Accounts](#test-accounts)

---

## โครงสร้างระดับบน

```
nida-dashboard-ui/
├── frontend-vite/          ← เว็บแอป React (หน้าตาที่ผู้ใช้เห็น)
├── backend/                ← API Server (Express.js + Prisma)
├── blockchain/             ← Smart Contract + Hardhat Node
├── database/               ← Prisma schema (source of truth)
├── document/               ← เอกสาร (installation_manual, developer_manual)
├── docker-compose.yml      ← Production deploy
├── .env                    ← Environment variables (API keys, DB URL, etc.)
└── DEEPSEEK.md             ← Context หลักของโปรเจค (อ่านก่อนเสมอ)
```

---

## Frontend (`frontend-vite/`)

### ภาพรวม folder

```
frontend-vite/
├── src/
│   ├── pages/              ← 📄 ทุกหน้าของเว็บ — 1 ไฟล์ = 1 หน้า
│   ├── components/         ← 🧩 UI ชิ้นส่วนที่ใช้ซ้ำหลายหน้า
│   ├── core/data_connecter/← 🔌 ตัวเรียก API — ห้ามใช้ axios โดยตรง!
│   ├── store/              ← 🏪 Redux state (auth, member)
│   ├── global/             ← 🌐 ค่าคงที่ (localStorage keys)
│   └── utils/              ← 🛠 ฟังก์ชันช่วย (format date, convert number)
├── nginx.conf              ← nginx config สำหรับ production
├── index.html              ← Entry HTML
├── vite.config.js          ← Vite config
├── tailwind.config.js      ← Tailwind theme
└── package.json            ← Dependencies
```

---

### Pages — หน้าทั้งหมดของแอป

📁 **`src/pages/`** — ทุกไฟล์ในนี้คือ 1 หน้าในเว็บ

```
pages/
├── dashboard/
│   └── dashboardHome.js    ← 🏠 หน้าหลัก Admin Dashboard
│                              แสดงภาพรวม: พลังงาน, ธุรกรรม, อาคาร
│                              │
├── energy/
│   ├── report.js           ← 📊 หน้ารายงานพลังงาน
│   │                          มี EnergyChart (custom SVG) — แสดงกราฟผลิต/ใช้/SoC
│   │                          ⚠️ ถ้าจะเพิ่ม chart แบบใหม่ → สร้าง component ใหม่
│   │                          อย่าแก้ EnergyChart โดยตรง
│   │                          │
│   ├── meter.js            ← 🔌 หน้ารายละเอียดมิเตอร์ตัวเดียว
│   │                          ดูข้อมูล kWh, สถานะ, ประวัติ
│   │                          │
│   └── meterRegistration.js← 📝 หน้าลงทะเบียนมิเตอร์ใหม่
│                              กรอก snid, ประเภท, อาคาร
│                              │
├── trading/
│   ├── market.js           ← 🏪 Marketplace — หน้ารวม offers และ bids
│   │                          แสดงรายการซื้อ-ขายพลังงานทั้งหมด
│   │                          │
│   ├── energySelling.js    ← ⚡ หน้าตั้งค่า trade mode + manual sell
│   │                          🔑 ใช้ EnergySellingPanel component
│   │                          handleSaveTradePolicy() → บันทึก tradeMode ลง DB
│   │                          │
│   └── mockEnergy.js       ← 🧪 สร้างข้อมูลปลอมสำหรับทดสอบ
│                              กดปุ่ม generate → สร้าง meter readings จำลอง
│                              │
└── billing/
    ├── wallet.js           ← 💰 หน้ากระเป๋าตังค์
    │                          ดูยอด token, top-up, ประวัติธุรกรรม
    │                          │
    ├── receipts.js         ← 🧾 รายการใบเสร็จ (auto-refresh ทุก 15s)
    │                          │
    └── invoices.js         ← 📋 จัดการใบแจ้งหนี้
                               ดูสถานะ paid/late/cancelled
```

### Components — ชิ้นส่วน UI ที่ใช้ซ้ำ

📁 **`src/components/`** — ชิ้นส่วนที่ถูกเรียกใช้จากหลายหน้า

```
components/
└── shared/
    ├── energySellingPanel.js  ← 🔑 แผงซื้อ-ขายพลังงาน (ใช้ใน energySelling.js)
    │                              มี 2 tabs:
    │                              ☀️ Solar Array  — ตั้งค่า solar trade mode
    │                              🔋 Storage System — ตั้งค่า battery trade mode
    │                              ⚠️ storageMode เป็น local state — ไม่ sync กับ backend
    │                              │
    └── MarketTimeline.js       ← ⏰ นับถอยหลัง Day-Ahead market
                                   แสดงเวลาเปิด/ปิด/clearing
```

### Data Connectors — ตัวเชื่อม API

📁 **`src/core/data_connecter/`** — ห้ามใช้ axios โดยตรงจากหน้าเพจ ต้องเรียกผ่านไฟล์ที่นี่เท่านั้น

```
core/data_connecter/
├── market.js       ← 🏪 API ตลาด: ดึง offers, bids
├── purchase.js     ← 💸 API ซื้อพลังงาน: สร้าง transaction
├── register.js     ← 📝 API ลงทะเบียน: user, building, meter
├── wallet.js       ← 💰 API wallet: top-up, เช็คยอด
├── building.js     ← 🏢 API อาคาร: CRUD, ตั้งค่า trade mode
└── rate.js         ← 📊 API เรท: ดึงราคาตลาด
```

**วิธีใช้:**
```js
// ✅ ถูกต้อง
import { purchaseEnergy } from '../../core/data_connecter/purchase';
const response = await purchaseEnergy({ offerId, buyerWalletId });

// ❌ ผิด — อย่าทำ
const response = await axios.post('/api/energy/purchase', { ... });
```

### Store (Redux) — จัดการ state ทั้งแอป

📁 **`src/store/`** — ใช้ Redux Toolkit + redux-persist (เก็บ state ลง localStorage)

```
store/
├── index.js               ← ตั้งค่า store + redux-persist
│
├── auth/                  ← 🔐 จัดการ user login/logout
│   ├── auth.action.js     ← ฟังก์ชัน login(), logout(), storeSession()
│   ├── auth.reducer.js    ← state: { user, token, loading }
│   └── auth.types.js      ← ชื่อ action types
│
└── member/                ← 👤 จัดการข้อมูลสมาชิก
    ├── member.action.js
    ├── member.reducer.js
    └── member.types.js
```

**วิธีใช้ในหน้าเพจ:**
```js
const { user, token } = useSelector(state => state.auth);
dispatch(login({ email, password }));
```

### Utils & Global

📁 **`src/utils/`**
```
utils/
├── energyAnalytics.js     ← 🛠 ฟังก์ชันช่วยด้านพลังงาน
│   ├── toNumeric(value)           ← แปลงค่าเป็นตัวเลข (null → 0)
│   ├── formatDateLocal(date)      ← Date → "YYYY-MM-DD"
│   ├── getLatestMeterDate(data)   ← หา timestamp ล่าสุดจาก meter data
│   └── buildThreeHourSeries(data) ← รวมข้อมูลรายชั่วโมงเป็นช่วง 3 ชม.
└── formatters.js          ← 🛠 format ตัวเลข, วันที่, สกุลเงิน
```

📁 **`src/global/`**
```
global/
└── key.js                 ← 🔑 localStorage key names:
                              Token, UserId, UserEmail, UserRole
```

---

## Backend (`backend/`)

### ภาพรวม folder

```
backend/
├── app.js                 ← 🔑 จุดรวม route ทั้งหมด + direct endpoints
├── server.js              ← 🚀 ตัว start server
├── utils/
│   └── prisma.js          ← 🔑 Prisma Proxy (AsyncLocalStorage)
│                              ห้าม import PrismaClient โดยตรง!
├── features/              ← 📦 แต่ละ feature แยก folder
├── middleware/             ← 🔗 กั้นกลาง request
├── prisma/
│   └── schema.prisma      ← 🗄️ Database schema (source of truth)
└── package.json
```

### Entry Points

| ไฟล์ | หน้าที่ | เมื่อไหร่ที่ต้องแก้ |
|------|--------|-------------------|
| `server.js` | จุดเริ่มต้น — `node server.js` | แทบไม่ต้องแก้ |
| `app.js` | 🔑 Express app — ลงทะเบียน routes + direct endpoints | **เพิ่ม route ใหม่**, **เพิ่ม direct endpoint** |

**ตัวอย่าง Direct Endpoints ใน `app.js`:**
```js
GET  /api/transactions                        ← ดึง transactions ทั้งหมด
GET  /api/transactions/blockchain/recent      ← blockchain transactions ล่าสุด
GET  /api/transactions/blockchain/tx/:txHash  ← เช็ค single transaction
GET  /api/transactions/:id                    ← transaction detail
GET  /api/transactions/:id/verification-preview← preview ก่อน verify
```

### Features — แต่ละ feature แยก folder

📁 **`backend/features/`** — แต่ละ folder มีหน้าที่เฉพาะ แยกขาดจากกัน

#### 🔐 `features/users/` — จัดการผู้ใช้
```
users/
├── users.routes.js        ← /api/users/*
├── users.controller.js    ← รับ request → เรียก service
└── users.service.js       ← business logic: register, login, OTP
```
**ใช้สำหรับ:** ลงทะเบียน, login, ส่ง OTP ทาง email

#### 💰 `features/billing/` — ใบแจ้งหนี้ & ใบเสร็จ
```
billing/
├── invoice.service.js     ← 🔑 สร้าง invoice + receipt ตอนซื้อพลังงาน
└── invoice.model.js       ← CRUD invoice
```
**ใช้สำหรับ:** ออก invoice/receipt อัตโนมัติหลังซื้อขาย, ดูประวัติการชำระ

#### ⚡ `features/trading/` — ตลาดพลังงาน
```
trading/
├── trade.engine.js        ← 🔑 Auto-trade engine (cron: 15:00 น. ทุกวัน)
│                             ตรวจสอบทุกอาคาร → สร้าง offer/bid อัตโนมัติ
│                             │
├── market.service.js      ← 🔑 Day-Ahead market clearing (~00:00 น.)
│                             executeMarketClearing() — จับคู่ bid/offer
│                             │
├── market.utils.js        ← 🏷️ ค่าคงที่: TRADE_MODES, normalizeTradeMode()
│                             │
└── offer.repository.js    ← 🗄️ CRUD offers/bids (query ผ่าน Prisma)
```
**ใช้สำหรับ:** สร้าง/ยกเลิก offer, จับคู่ซื้อ-ขาย, auto-trade

#### 🔌 `features/energy/` — ข้อมูลมิเตอร์
```
energy/
└── energyAggregation.js   ← 🔑 Aggregate RunningMeter → Hourly/Daily/Weekly/Monthly
                             (cron: ทุกชั่วโมง)
```
**ใช้สำหรับ:** rollup ข้อมูลมิเตอร์, mock data generator

#### ⛓️ `features/transactions/` — Blockchain
```
transactions/
└── transactionVerification.service.js  ← ตรวจสอบ transaction บน blockchain
                                          ⚠️ ใช้ lazy require เพื่อเลี่ยง circular dep
```
**ใช้สำหรับ:** verify transaction on-chain, ดู txHash

#### 🏢 `features/wallets/` — กระเป๋าตังค์
```
wallets/
└── wallet.service.js      ← top-up, transfer, check balance
```

#### 🏗️ `features/building/` — อาคาร
```
building/
└── building.model.js      ← CRUD building + validate trade mode
```
**ใช้สำหรับ:** สร้าง/แก้ไขอาคาร, ตั้งค่า trade mode, threshold

### Middleware

📁 **`backend/middleware/`** — ทำงานก่อนทุก request

```
middleware/
├── auth.js                ← 🔐 ตรวจสอบ JWT token
│                             ใส่ใน route ที่ต้องการ login
│                             │
└── dataModeMiddleware.js  ← 🔀 เลือกฐานข้อมูล real หรือ demo
                              อ่าน header x-data-mode หรือ DEFAULT_DATA_MODE
                              → ตั้งค่า AsyncLocalStorage → prisma proxy สลับ DB ให้
```

**ลำดับ middleware (ทุก request):**
```
cors → express.json → dataModeMiddleware → authMiddleware → router
```

### Prisma Proxy (สำคัญที่สุด!)

📄 **`utils/prisma.js`** — นี่คือไฟล์ที่สำคัญที่สุดใน backend

```
ใช้ AsyncLocalStorage เพื่อสลับฐานข้อมูล real/demo ต่อ request
```

**กฎตายตัว:**
```js
// ✅ ถูกต้อง — ใช้แบบนี้ทุกที่
const { prisma } = require('../../utils/prisma');

// ❌ ผิด — อย่าทำเด็ดขาด
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
```

---

## Database Schema

📄 **`database/schema.prisma`** — แหล่งความจริงของโครงสร้าง Database

### ตารางหลัก
| Table | หน้าที่ | Key Fields |
|-------|--------|-----------|
| `User` | ผู้ใช้ | `credId` (UUID), `email`, `role` |
| `Building` | อาคาร | `id` (int), `name`, `tradeMode`, `solarTradeMode`, `batteryTradeMode` |
| `MeterInfo` | มิเตอร์ | `snid` (PK), `buildingName`, `type`, `kWH` |
| `Wallet` | กระเป๋าตังค์ | `id` (string PK), `email`, `tokenBalance` |
| `EnergyOffer` | คำเสนอขาย | `id` (UUID), `kWH`, `ratePerkWH`, `status` |
| `EnergyBid` | คำเสนอซื้อ | `id` (int), `kWH`, `ratePerkWH`, `status` |
| `Transaction` | ธุรกรรม | `txid` (UUID), `tokenAmount`, `txHash` |
| `Invoice` | ใบแจ้งหนี้ | `id` (UUID), `buildingName`, `kWH`, `status` |
| `Receipt` | ใบเสร็จ | `id` (UUID), `invoiceId` (FK) |
| `BlockTransaction` | บันทึก blockchain | `txHash` (unique), `receiptId` |
| `Battery` | แบตเตอรี่ | `snid`, `capacitykWH`, `currentkWH` |
| `MarketOrder` | คำสั่งตลาด | `side` (BID/OFFER), `price`, `quantity` |
| `MarketMatch` | การจับคู่ | `buyerOrderId`, `sellerOrderId`, `price` |
| `MarketRun` | รอบตลาด | `marketType`, `runTime`, `status` |

### ตารางพลังงาน (Energy Aggregation)
| Table | Primary Key | Fields |
|-------|------------|--------|
| `RunningMeter` | `snid` + `timestamp` | `kW`, `kWH` |
| `HourlyEnergy` | `meterSnid` + `date` | `h0`-`h23`, `kwh` |
| `DailyEnergy` | `meterSnid` + `year` + `month` | `d1`-`d31`, `kwh` |
| `WeeklyEnergy` | `meterSnid` + `year` + `week` | `sun`-`sat`, `kwh` |
| `MonthlyEnergy` | `meterSnid` + `year` | `M1`-`M12`, `kwh` |

> ⚠️ **ระวัง field name!**  
> `RunningMeter`, `MeterInfo` → ใช้ `kWH` (ตัวพิมพ์ใหญ่)  
> `HourlyEnergy`, `DailyEnergy`, `WeeklyEnergy`, `MonthlyEnergy` → ใช้ `kwh` (ตัวพิมพ์เล็ก)  
> Energy table ใช้ `meterSnid` (ไม่ใช่ `meterId`)

---

## กฎเหล็กที่ต้องจำ

### 🔴 ห้ามทำเด็ดขาด

| ❌ อย่าทำ | ✅ ให้ทำแทน |
|----------|-----------|
| `import PrismaClient` โดยตรง | `const { prisma } = require('../../utils/prisma')` |
| ใช้ `axios` โดยตรงในหน้าเพจ | ใช้ `core/data_connecter/` |
| Top-level `require` ที่ทำให้ circular dep | ใช้ lazy require ใน function body |
| แก้ `EnergyChart` ใน `report.js` เพิ่ม chart ใหม่ | สร้าง component ใหม่แยก |
| ใช้ `meterId` บน DailyEnergy/HourlyEnergy | ใช้ `meterSnid` |
| ใช้ `kWH` (uppercase) บน DailyEnergy/HourlyEnergy | ใช้ `kwh` (lowercase) |

### 🟡 Field Name Map (ดูบ่อย)

| Table | ID Field | Energy Field |
|-------|----------|-------------|
| RunningMeter | `snid` | `kWH` ↑ |
| MeterInfo | `snid` | `kWH` ↑ |
| HourlyEnergy | `meterSnid` | `kwh` ↓ |
| DailyEnergy | `meterSnid` | `kwh` ↓ |
| WeeklyEnergy | `meterSnid` | `kwh` ↓ |
| MonthlyEnergy | `meterSnid` | `kwh` ↓ |

### 🟢 Pattern ที่ต้องใช้

```js
// ✅ API call — ผ่าน data_connecter
import { someApi } from '../../core/data_connecter/someModule';

// ✅ Prisma — ผ่าน proxy
const { prisma } = require('../../utils/prisma');

// ✅ Lazy require — สำหรับเลี่ยง circular dependency
async function doSomething() {
    const { verifyTransaction } = require('../transactions/transactionVerification.service');
}

// ✅ Error handling — ใช้ antd notification
notification.error({
    message: 'เกิดข้อผิดพลาด',
    description: err.response?.data?.error || err.message
});

// ✅ Response format จาก backend
{ "success": true, "data": { ... } }
{ "error": "ข้อความ error" }
```

---

## Test Accounts

| Role | Email | Password | สิทธิ์ |
|------|-------|----------|--------|
| Admin | `admin@nida.com` | `admin123` | ทุกอย่าง |
| User | ลงทะเบียนเอง | ตั้งเอง | ตาม building |

### อาคารในระบบ
| ชื่อ | ID | Solar | Battery |
|------|----|-------|---------|
| นิด้า สรรพคุณ | 1 | ✅ | ✅ |
| นรา ทิพย์ | 2 | ✅ | ✅ |
| นิด้า บางซื่อ | 3 | ✅ | ✅ |
| สรรพคุณ 2 | 4 | ✅ | ✅ |
| ทราย ฟ้า | 5 | ✅ | ✅ |

> ⚠️ **Building Name Issue**: `nidasumpan` → `nidasumpun`, `narathip` → `naradhip`  
> ใช้ `buildingId` แทนชื่อเพื่อเลี่ยงปัญหา

---

## Quick Reference — แก้ไขอะไร ไปไฟล์ไหน

| อยากแก้... | ไปที่ไฟล์ |
|-----------|---------|
| เพิ่มหน้าใหม่ | `frontend-vite/src/pages/{category}/{page}.js` |
| เพิ่ม route ใหม่ | `frontend-vite/src/App.jsx` |
| เพิ่ม API endpoint ใหม่ | `backend/app.js` (ลงทะเบียน route) |
| เพิ่ม feature ใหม่ (backend) | สร้าง folder ใน `backend/features/{ชื่อ}/` |
| เปลี่ยน logic ตลาด | `backend/features/trading/market.service.js` |
| เปลี่ยน auto-trade | `backend/features/trading/trade.engine.js` |
| เพิ่ม chart ใหม่ | สร้าง component ใหม่ — อย่าแก้ `report.js` |
| เปลี่ยน trade mode UI | `frontend-vite/src/components/shared/energySellingPanel.js` |
| เปลี่ยน Database schema | `database/schema.prisma` → `npx prisma migrate dev` |
| เพิ่ม env var | `.env` + `docker-compose.yml` (ทั้งสองที่!) |
| Deploy ขึ้น production | `docker compose build` → `docker push` → VM: `docker compose up -d` |

---

## แหล่งอ้างอิง

- **DEEPSEEK.md** — ไฟล์ context หลัก อ่านก่อนเสมอ
- **document/installation_manual.md** — คู่มือติดตั้งด้วย Docker
- **database/schema.prisma** — Database schema
