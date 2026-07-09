# NIDA Smart Grid — คู่มือนักพัฒนา

> สำหรับ developer ที่ต้องการแก้ไขหรือเพิ่ม feature ในโปรเจคนี้  
> อ่านเล่มนี้ก่อนเริ่มเขียนโค้ด — จะรู้ว่าไฟล์ไหนทำอะไร ต้องแก้ตรงไหน

---

## สารบัญ

1. [โครงสร้างโปรเจค](#1-โครงสร้างโปรเจค)
2. [Frontend — แต่ละไฟล์ทำอะไร](#2-frontend--แต่ละไฟล์ทำอะไร)
3. [Backend — แต่ละไฟล์ทำอะไร](#3-backend--แต่ละไฟล์ทำอะไร)
4. [Database Schema](#4-database-schema)
5. [กฎที่ต้องรู้ก่อนเขียนโค้ด](#5-กฎที่ต้องรู้ก่อนเขียนโค้ด)
6. [Test Accounts](#6-test-accounts)
7. [Quick Reference — อยากแก้ X ต้องไปไฟล์ไหน](#7-quick-reference--อยากแก้-x-ต้องไปไฟล์ไหน)

---

## 1. โครงสร้างโปรเจค

```
nida-dashboard-ui/
│
├── frontend-vite/          เว็บแอป React (สิ่งที่ผู้ใช้เห็น)
├── backend/                API Server (Express.js + Prisma)
├── blockchain/             Smart Contract + Hardhat Node
├── database/               Prisma schema (โครงสร้างฐานข้อมูล)
├── document/               เอกสารโปรเจค
├── docker-compose.yml      ใช้ deploy ขึ้น production
├── .env                    ค่าคอนฟิก (API keys, database URL)
└── DEEPSEEK.md             ไฟล์ context หลัก — อ่านก่อนทุกครั้ง
```

---

## 2. Frontend — แต่ละไฟล์ทำอะไร

### 2.1 ไฟล์ระดับบนสุด

| ไฟล์ | ทำหน้าที่ | แก้เมื่อไหร่ |
|------|----------|-------------|
| `index.html` | จุดเริ่มต้น — ไฟล์ HTML เปล่าๆ ที่ Vite ใช้ inject React | แทบไม่ต้องแก้ |
| `vite.config.js` | ตั้งค่า Vite (port, proxy, plugins) | เปลี่ยน port dev server, เพิ่ม proxy |
| `tailwind.config.js` | ตั้งค่า Tailwind CSS | เพิ่มสี/ font/ breakpoint ใหม่ |
| `nginx.conf` | nginx config สำหรับ production | เปลี่ยน routing บน production |
| `package.json` | รายการ dependencies + scripts | เพิ่ม/ลบ package |

### 2.2 pages/ — หน้าทั้งหมดของเว็บ

ทุกไฟล์ = 1 หน้าเว็บ 1 หน้า

| ไฟล์ | ทำหน้าที่ | จุดสำคัญ |
|------|----------|---------|
| `pages/dashboard/dashboardHome.js` | หน้าแรก Admin — แสดงภาพรวมพลังงาน, ธุรกรรม, อาคาร | - |
| `pages/energy/report.js` | หน้ารายงานพลังงาน — กราฟ SVG แสดงผลิต/ใช้/SoC | ห้ามแก้ EnergyChart โดยตรง — ถ้าจะเพิ่ม chart ใหม่ให้สร้าง component ใหม่ |
| `pages/energy/meter.js` | ดูรายละเอียดมิเตอร์ตัวเดียว — kWh, สถานะ, ประวัติ | - |
| `pages/energy/meterRegistration.js` | ลงทะเบียนมิเตอร์ใหม่ — กรอก snid, ประเภท, อาคาร | - |
| `pages/trading/market.js` | Marketplace — รายการ offers และ bids ทั้งหมด | - |
| `pages/trading/energySelling.js` | ตั้งค่า trade mode + manual sell | ใช้ `energySellingPanel` component; `handleSaveTradePolicy()` บันทึกลง DB |
| `pages/trading/mockEnergy.js` | สร้างข้อมูลปลอมสำหรับทดสอบ | - |
| `pages/billing/wallet.js` | กระเป๋าตังค์ — ยอด token, top-up, ประวัติ | - |
| `pages/billing/receipts.js` | รายการใบเสร็จ — auto-refresh ทุก 15 วิ | - |
| `pages/billing/invoices.js` | จัดการใบแจ้งหนี้ — สถานะ paid/late/cancelled | - |

### 2.3 components/ — UI ที่ใช้ซ้ำหลายหน้า

| ไฟล์ | ทำหน้าที่ | จุดสำคัญ |
|------|----------|---------|
| `components/shared/energySellingPanel.js` | แผงซื้อ-ขายพลังงาน (Solar Array + Storage System) | `storageMode` เป็น local state — ไม่ sync กับ backend |
| `components/shared/MarketTimeline.js` | นับถอยหลัง Day-Ahead market (เปิด/ปิด/clearing) | - |

### 2.4 core/data_connecter/ — ตัวเรียก API

**กฎ:** ห้ามใช้ `axios` โดยตรงจากหน้าเพจ — ต้องเรียกผ่านไฟล์ในนี้เท่านั้น

| ไฟล์ | ใช้เรียก API อะไร |
|------|-----------------|
| `market.js` | ดึง offers, bids จากตลาด |
| `purchase.js` | ซื้อพลังงาน — สร้าง transaction |
| `register.js` | ลงทะเบียน user, building, meter |
| `wallet.js` | wallet: top-up, เช็คยอด |
| `building.js` | อาคาร: CRUD, ตั้งค่า trade mode |
| `rate.js` | ดึงราคาตลาด |

**วิธีใช้:**
```js
// ✅ ถูกต้อง
import { purchaseEnergy } from '../../core/data_connecter/purchase';
const res = await purchaseEnergy({ offerId, buyerWalletId });

// ❌ ผิด — อย่าทำ
const res = await axios.post('/api/energy/purchase', { ... });
```

### 2.5 store/ — Redux State Management

ใช้ Redux Toolkit + redux-persist (state ถูกบันทึกใน localStorage)

| ไฟล์/โฟลเดอร์ | ทำหน้าที่ |
|--------------|----------|
| `store/index.js` | ตั้งค่า store + redux-persist |
| `store/auth/auth.action.js` | ฟังก์ชัน `login()`, `logout()`, `storeSession()` |
| `store/auth/auth.reducer.js` | จัดการ state: `{ user, token, loading }` |
| `store/auth/auth.types.js` | ชื่อ action types |
| `store/member/` | จัดการข้อมูลสมาชิก (action, reducer, types) |

**วิธีใช้ในหน้าเพจ:**
```js
const { user, token } = useSelector(state => state.auth);
dispatch(login({ email, password }));
```

### 2.6 utils/ — ฟังก์ชันช่วย

| ไฟล์ | ฟังก์ชันสำคัญ | ใช้ทำอะไร |
|------|-------------|----------|
| `utils/energyAnalytics.js` | `toNumeric(value)` | แปลงค่าเป็นตัวเลข (null → 0) |
| | `formatDateLocal(date)` | Date → "YYYY-MM-DD" |
| | `getLatestMeterDate(data)` | หา timestamp ล่าสุดจาก meter data |
| | `buildThreeHourSeries(data)` | รวมข้อมูลรายชั่วโมงเป็นช่วง 3 ชม. |
| `utils/formatters.js` | - | format ตัวเลข, วันที่, สกุลเงิน |

### 2.7 global/ — ค่าคงที่

| ไฟล์ | เนื้อหา |
|------|--------|
| `global/key.js` | localStorage key names: `Token`, `UserId`, `UserEmail`, `UserRole` |

---

## 3. Backend — แต่ละไฟล์ทำอะไร

### 3.1 ไฟล์ระดับบนสุด

| ไฟล์ | ทำหน้าที่ | แก้เมื่อไหร่ |
|------|----------|-------------|
| `server.js` | จุดเริ่มต้น — `node server.js` | แทบไม่ต้องแก้ |
| `app.js` | Express app — ลงทะเบียน routes ทั้งหมด + direct endpoints | เพิ่ม route ใหม่, เพิ่ม direct endpoint |
| `package.json` | Dependencies + scripts | เพิ่ม/ลบ package |

### 3.2 features/ — แยกตาม feature

| โฟลเดอร์ | ไฟล์สำคัญ | ทำหน้าที่ |
|---------|----------|----------|
| `features/users/` | `users.routes.js` | `/api/users/*` — routes |
| | `users.controller.js` | รับ request → เรียก service |
| | `users.service.js` | business logic: register, login, OTP |
| | | |
| `features/billing/` | `invoice.service.js` | สร้าง invoice + receipt ตอนซื้อพลังงาน |
| | `invoice.model.js` | CRUD invoice |
| | | |
| `features/trading/` | `trade.engine.js` | Auto-trade engine — ทำงานทุก 15:00 น. |
| | `market.service.js` | Day-Ahead market clearing — จับคู่ bid/offer |
| | `market.utils.js` | ค่าคงที่ `TRADE_MODES` + `normalizeTradeMode()` |
| | `offer.repository.js` | CRUD offers/bids (query ผ่าน Prisma) |
| | | |
| `features/energy/` | `energyAggregation.js` | Aggregate RunningMeter → Hourly/Daily/Weekly/Monthly |
| | | |
| `features/transactions/` | `transactionVerification.service.js` | ตรวจสอบ transaction บน blockchain |
| | | |
| `features/wallets/` | `wallet.service.js` | top-up, transfer, check balance |
| | | |
| `features/building/` | `building.model.js` | CRUD building + validate trade mode |

### 3.3 middleware/ — ตัวกรองก่อนถึง route

| ไฟล์ | ทำหน้าที่ |
|------|----------|
| `middleware/auth.js` | ตรวจสอบ JWT token — ใส่ใน route ที่ต้องการ login |
| `middleware/dataModeMiddleware.js` | เลือกฐานข้อมูล real/demo ตาม header `x-data-mode` |

**ลำดับการทำงานของ middleware (ทุก request):**
```
cors → express.json → dataModeMiddleware → authMiddleware → router
```

### 3.4 utils/prisma.js — Prisma Proxy

**ไฟล์สำคัญที่สุดใน backend** — ใช้ `AsyncLocalStorage` สลับฐานข้อมูล real/demo ต่อ request

```js
// ✅ ถูกต้อง — ใช้แบบนี้ทุกที่
const { prisma } = require('../../utils/prisma');

// ❌ ผิด — ห้ามทำเด็ดขาด
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
```

---

## 4. Database Schema

### 4.1 ตารางหลัก

| Table | หน้าที่ | Key Fields |
|-------|--------|-----------|
| `User` | ผู้ใช้ | `credId` (UUID), `email` (PK), `role` |
| `Building` | อาคาร | `id` (int), `name`, `tradeMode`, `solarTradeMode`, `batteryTradeMode` |
| `MeterInfo` | มิเตอร์ | `snid` (PK), `buildingName`, `type`, `kWH` |
| `Wallet` | กระเป๋าตังค์ | `id` (string PK), `email`, `tokenBalance` |
| `EnergyOffer` | คำเสนอขาย | `id` (UUID), `sellerWalletId`, `kWH`, `ratePerkWH`, `status` |
| `EnergyBid` | คำเสนอซื้อ | `id` (int), `buyerWalletId`, `kWH`, `ratePerkWH`, `status` |
| `Transaction` | ธุรกรรม | `txid` (UUID), `walletId`, `tokenAmount`, `txHash`, `status` |
| `Invoice` | ใบแจ้งหนี้ | `id` (UUID), `buildingName`, `fromWId`, `toWId`, `kWH`, `status` |
| `Receipt` | ใบเสร็จ | `id` (UUID), `invoiceId` (FK → Invoice) |
| `BlockTransaction` | บันทึก blockchain | `id` (UUID), `txHash` (unique), `receiptId` |
| `Battery` | แบตเตอรี่ | `snid` (unique), `capacitykWH`, `currentkWH`, `buildingId` |
| `MarketOrder` | คำสั่งตลาด | `id` (UUID), `side` (BID/OFFER), `marketType`, `price`, `quantity` |
| `MarketMatch` | การจับคู่ | `id` (UUID), `buyerOrderId`, `sellerOrderId`, `quantity`, `price` |
| `MarketRun` | รอบตลาด | `id` (UUID), `marketType`, `runTime`, `status` |

### 4.2 ตารางพลังงาน

| Table | Primary Key | Fields | Energy Field |
|-------|------------|--------|-------------|
| `RunningMeter` | `snid` + `timestamp` | `kW`, `kWH` | `kWH` (ตัวใหญ่) |
| `HourlyEnergy` | `meterSnid` + `date` | `h0`-`h23`, `kwh` | `kwh` (ตัวเล็ก) |
| `DailyEnergy` | `meterSnid` + `year` + `month` | `d1`-`d31`, `kwh` | `kwh` (ตัวเล็ก) |
| `WeeklyEnergy` | `meterSnid` + `year` + `week` | `sun`-`sat`, `kwh` | `kwh` (ตัวเล็ก) |
| `MonthlyEnergy` | `meterSnid` + `year` | `M1`-`M12`, `kwh` | `kwh` (ตัวเล็ก) |

### 4.3 Field Name Rules — ระวัง!

| กฎ | ตัวอย่างผิด | ตัวอย่างถูก |
|----|----------|----------|
| Energy table ใช้ `meterSnid` (ไม่ใช่ `meterId`) | `prisma.dailyEnergy.findFirst({ where: { meterId: x } })` | `prisma.dailyEnergy.findFirst({ where: { meterSnid: x } })` |
| RunningMeter/MeterInfo ใช้ `kWH` (ตัวใหญ่) | `prisma.runningMeter.findFirst({ where: { kwh: x } })` | `prisma.runningMeter.findFirst({ where: { kWH: x } })` |
| Daily/Hourly/Weekly/MonthlyEnergy ใช้ `kwh` (ตัวเล็ก) | `prisma.dailyEnergy.findFirst({ where: { kWH: x } })` | `prisma.dailyEnergy.findFirst({ where: { kwh: x } })` |

---

## 5. กฎที่ต้องรู้ก่อนเขียนโค้ด

### 5.1 ห้ามทำเด็ดขาด

| ❌ ผิด | ✅ ถูก |
|-------|------|
| `import { PrismaClient }` โดยตรง | `const { prisma } = require('../../utils/prisma')` |
| ใช้ `axios` โดยตรงในหน้าเพจ | ใช้ `core/data_connecter/` |
| Top-level `require` ที่ทำให้ circular dependency | ใช้ lazy require ใน function body |
| แก้ `EnergyChart` ใน `report.js` เพื่อเพิ่ม chart ใหม่ | สร้าง component ใหม่แยก |
| ใช้ `meterId` บนตาราง Daily/Hourly/Weekly/MonthlyEnergy | ใช้ `meterSnid` |

### 5.2 Lazy Require — เลี่ยง Circular Dependency

```js
// ✅ ถูก — require ใน function body
async function sellToBid() {
    const { verifyTransaction } = require('../transactions/transactionVerification.service');
}

// ❌ ผิด — top-level require
const { verifyTransaction } = require('../transactions/transactionVerification.service');
```

### 5.3 Error Handling

```js
import { notification } from 'antd';

try {
    const res = await someApiCall();
    notification.success({ message: 'สำเร็จ' });
} catch (err) {
    notification.error({
        message: 'เกิดข้อผิดพลาด',
        description: err.response?.data?.error || err.message
    });
}
```

### 5.4 Response Format

```js
// Backend response
{ "success": true, "data": { ... } }        // สำเร็จ — object
{ "success": true, "data": [ ... ] }        // สำเร็จ — array
{ "error": "ข้อความ error" }                 // ผิดพลาด
```

### 5.5 Building Name Normalization

```js
// บางอาคารมีชื่อไม่ตรงกันระหว่างระบบเก่า-ใหม่
// "nidasumpan" → "nidasumpun"
// "narathip"   → "naradhip"
// ใช้ buildingId แทนชื่อเพื่อเลี่ยงปัญหานี้
```

---

## 6. Test Accounts

### บัญชีทดสอบ

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@nida.com` | `admin123` |
| User | ลงทะเบียนเอง | ตั้งเอง |

### อาคารในระบบ

| ID | ชื่อ | Solar | Battery |
|----|------|-------|---------|
| 1 | นิด้า สรรพคุณ | ✅ | ✅ |
| 2 | นรา ทิพย์ | ✅ | ✅ |
| 3 | นิด้า บางซื่อ | ✅ | ✅ |
| 4 | สรรพคุณ 2 | ✅ | ✅ |
| 5 | ทราย ฟ้า | ✅ | ✅ |

---

## 7. Quick Reference — อยากแก้ X ต้องไปไฟล์ไหน

| อยากแก้... | ไปที่ไฟล์ |
|-----------|---------|
| เพิ่มหน้าใหม่ | `frontend-vite/src/pages/{category}/{page}.js` |
| เพิ่ม route | `frontend-vite/src/App.jsx` |
| เพิ่ม API endpoint | `backend/app.js` |
| เพิ่ม feature ใหม่ (backend) | สร้าง folder ใน `backend/features/{ชื่อ}/` |
| เปลี่ยน logic ตลาด | `backend/features/trading/market.service.js` |
| เปลี่ยน auto-trade | `backend/features/trading/trade.engine.js` |
| เปลี่ยน trade mode UI | `frontend-vite/src/components/shared/energySellingPanel.js` |
| เพิ่ม chart ใหม่ | สร้าง component ใหม่ (อย่าแก้ `report.js` โดยตรง) |
| เปลี่ยน database schema | `database/schema.prisma` → `npx prisma migrate dev` |
| เพิ่ม environment variable | `.env` **และ** `docker-compose.yml` |
| Deploy ขึ้น production | `docker compose build` → `docker push` → VM: `docker compose up -d` |

---

## แหล่งอ้างอิง

| ไฟล์ | ใช้สำหรับ |
|------|----------|
| `DEEPSEEK.md` | Context หลักของโปรเจค — อ่านก่อนเริ่มงาน |
| `document/installation_manual.md` | คู่มือติดตั้งด้วย Docker |
| `database/schema.prisma` | โครงสร้างฐานข้อมูล (source of truth) |
