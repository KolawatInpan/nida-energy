# คู่มือสำหรับนักพัฒนา
# NIDA SMART GRID ENERGY TRADING AND MANAGEMENT SYSTEM
# DEVELOPER MANUAL

เอกสารฉบับนี้จัดทำขึ้นเพื่ออธิบายภาพรวมสถาปัตยกรรม โครงสร้างโค้ด แนวทางพัฒนา และแนวทาง deploy ของระบบ NIDA Smart Grid Energy Trading and Management System สำหรับนักพัฒนาที่ต้องการศึกษาหรือพัฒนาระบบต่อ

---

## 1. ภาพรวมของระบบ

ระบบนี้เป็นแพลตฟอร์มสำหรับจัดการข้อมูลพลังงานระดับอาคาร รองรับการลงทะเบียนมิเตอร์ การติดตามการผลิตและการใช้พลังงาน การจัดการ wallet และ token การออก invoice และ receipt รวมถึงการซื้อขายพลังงานแบบ peer-to-peer และการตรวจสอบธุรกรรมผ่าน blockchain

องค์ประกอบหลักของระบบประกอบด้วย:

- `frontend` สำหรับ Web Application ฝั่งผู้ใช้งาน
- `backend` สำหรับ API และ business logic
- `postgresql` สำหรับเก็บข้อมูลธุรกรรม พลังงาน ผู้ใช้ มิเตอร์ และ billing
- `blockchain` สำหรับ Ethereum/Hardhat verification layer

ระบบรองรับการทำงานทั้งในโหมด development ผ่าน Docker Compose และการ deploy แบบ single-server บน EC2 ด้วย Docker Compose

---

## 2. สถาปัตยกรรมของระบบ

แต่ละ service สามารถรันผ่าน Docker ได้ และเชื่อมต่อกันผ่าน network ภายในของ Docker Compose

### 2.1 องค์ประกอบหลัก

- `frontend`
  - พัฒนาด้วย React.js
  - ทำหน้าที่แสดง dashboard, marketplace, billing, report, blockchain explorer และหน้าจัดการต่าง ๆ
  - เรียกใช้งาน API ของ backend ผ่าน HTTP

- `backend`
  - พัฒนาด้วย Express.js
  - จัดการ API, authentication, business logic, invoice generation, wallet operations, marketplace, และ blockchain verification

- `postgres`
  - ใช้เก็บข้อมูลหลักของระบบ
  - ใช้ร่วมกับ Prisma ORM

- `blockchain`
  - ใช้ Hardhat และ smart contract สำหรับจำลองหรือบันทึก verification metadata
  - backend สามารถ publish verification payload hash ไปยัง chain ได้

### 2.2 รูปแบบการไหลของข้อมูล

ตัวอย่าง flow หลักของระบบ:

1. ผู้ใช้หรือแอดมินใช้งานผ่าน frontend
2. frontend เรียก backend ผ่าน REST API
3. backend ประมวลผล business logic และเชื่อมต่อ PostgreSQL ผ่าน Prisma
4. บาง flow จะเรียก Ethereum RPC หรือ smart contract เพื่อบันทึก verification data
5. backend ตอบผลกลับไปยัง frontend เพื่อแสดงผล

---

## 3. โครงสร้างของโปรเจกต์

โครงสร้างระดับ root ของ repository:

```text
backend/
blockchain/
frontend/
plantuml/
screenshot/
sequenceDiagram/
unit_test/
usecaseDiagram/
.env
.env.ec2.example
DEPLOY_EC2.md
docker-compose.dev.yml
docker-compose.ec2.yml
docker-compose.yml
README.md
```

---

## 4. คู่มือ Frontend สำหรับผู้พัฒนา

### 4.1 เทคโนโลยีที่ใช้

- React.js
- Redux
- React Router
- Ant Design
- Styled Components
- Utility helpers และ custom data connectors

### 4.2 โครงสร้างหลักของ Frontend

Frontend อยู่ภายใต้ `frontend/src`

```text
frontend/src/
  assets/
  components/
  core/
  global/
  integration_test/
  layouts/
  pages/
  routes/
  store/
  unit_test/
  utils/
  App.js
  Routes.js
  index.js
```

### 4.3 หน้าที่ของแต่ละส่วน

- `pages/`
  - เก็บ route-level pages ของระบบ
  - แยกตาม domain เช่น `dashboard`, `billing`, `energy`, `trading`, `blockchain`, `admin`, `auth`

- `components/`
  - เก็บ shared UI components ที่ใช้ร่วมกันหลายหน้า
  - ตัวอย่างเช่น `shared/energySellingPanel.js`

- `layouts/`
  - เก็บ layout components เช่น navbar หรือ menu
  - ตัวอย่างเช่น `layouts/navbar/LeftMenu.js`

- `routes/`
  - เก็บ route config และ route path helper
  - ใช้กำหนด URL กลางของระบบ

- `core/data_connecter/`
  - เก็บ functions สำหรับเรียก backend API
  - เช่น wallet, invoice, market, rate, dashboard

- `store/`
  - เก็บ redux actions และ state ที่เกี่ยวข้องกับ auth/member

- `utils/`
  - เก็บ helper functions ที่ใช้ซ้ำ เช่น formatter, chart logic, mapper, analytics helper

- `unit_test/`
  - เก็บ frontend unit tests สำหรับ pure logic

- `integration_test/`
  - เก็บ frontend integration tests สำหรับ page flow และ component flow

### 4.4 หน้าหลักของระบบ

ตัวอย่างหมวดหน้าใน `frontend/src/pages`

- `auth/`
  - หน้า login

- `dashboard/`
  - dashboard สำหรับ admin และ user

- `billing/`
  - wallet, invoice, invoice payment, receipt

- `energy/`
  - building, meter, report, meter registration

- `trading/`
  - 3D Smart Grid, market, mock energy

- `transactions/`
  - transaction history, trading history, transaction detail

- `blockchain/`
  - block explorer, blockchain compare, validators

- `admin/`
  - users, buildings, meters, approvals

### 4.5 แนวทางพัฒนา Frontend

- page-level logic ควรอยู่ใน `pages/`
- UI ที่ใช้ซ้ำให้แยกไป `components/` หรือ `layouts/`
- helper logic ที่ test ได้ง่ายควรแยกไป `utils/`
- route constants ควรใช้จาก `routes/routePaths.js`
- การเรียก API ใหม่ควรเพิ่มใน `core/data_connecter/`
- ถ้าต้องมี test ให้แยก pure logic ออกจาก component ก่อน แล้วค่อยเขียน unit test

---

## 5. คู่มือ Backend สำหรับผู้พัฒนา

### 5.1 เทคโนโลยีที่ใช้

- Express.js
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Ethereum / Ethers / Web3

### 5.2 บทบาทของ Backend

backend เป็นศูนย์กลางของระบบ ทำหน้าที่รับคำขอจาก frontend แล้วประมวลผล business logic ก่อนจะอ่านหรือเขียนข้อมูลผ่านฐานข้อมูล และเรียก blockchain เมื่อ flow นั้นต้องมีการ verify on-chain

สิ่งที่ backend รับผิดชอบหลัก ๆ ได้แก่:

- จัดการ API ของผู้ใช้ อาคาร มิเตอร์ wallet energy billing trading transaction และ system
- ตรวจสอบสิทธิ์ด้วย JWT และ role-based guard
- จัดการการอ่าน/เขียนข้อมูลผ่าน Prisma
- เตรียมข้อมูลสรุปสำหรับ dashboard และ report
- ทำงานร่วมกับ blockchain layer เพื่อ publish proof ของ transaction

### 5.3 โครงสร้างหลักของ Backend

```text
backend/
  config/
  db_migrations/
  features/
  integration_test/
  middleware/
  prisma/
  unit_test/
  utils/
  app.js
  server.js
```

### 5.4 โครงสร้างแบบ feature-based

backend ใช้แนวทางจัดโฟลเดอร์ตาม feature/domain แทนการรวมทุกอย่างไว้ใน `controllers/`, `models/`, `routes/`

ตัวอย่างภายใต้ `backend/features/`

```text
billing/
blockchain/
building/
dashboard/
energy/
meters/
rates/
system/
trading/
transactions/
users/
wallets/
```

### 5.5 หน้าที่ของแต่ละ feature

- `billing/`
  - invoice, receipt, payment flow, invoice sync จาก energy usage

- `blockchain/`
  - transaction verification, explorer data, chain metadata

- `building/`
  - ข้อมูลอาคารและการเชื่อมโยงกับผู้ใช้

- `dashboard/`
  - API สำหรับ hourly/daily/weekly/monthly energy query และ building energy summary

- `energy/`
  - running meters, energy aggregation, mock energy support, energy APIs

- `meters/`
  - register meter, fetch meter details, building-meter relation

- `rates/`
  - token rate และ energy rate

- `system/`
  - system-level operations เช่น reset หรือ utility routes

- `trading/`
  - offer creation, market order data, P2P trading flow

- `transactions/`
  - transaction records, blockchain comparison, verification preview

- `users/`
  - user management และ auth-related API บางส่วน

- `wallets/`
  - wallet registration, top-up, balance update

### 5.6 การไหลของ request ใน backend

หนึ่ง request ใน backend มักไหลตามลำดับนี้:

1. frontend เรียก API ของ backend
2. `app.js` รับ request และลง middleware ที่จำเป็น
3. `dataMode.js` กำหนดว่าจะใช้ real หรือ demo data
4. route ของ feature ที่เกี่ยวข้องรับ request ไปยัง controller/service
5. controller ตรวจสอบ input แล้วเรียก model หรือ service ที่เหมาะสม
6. Prisma หรือ blockchain service ทำงานตาม business logic
7. backend ส่ง response กลับไปยัง frontend

### 5.7 Middleware สำคัญ

โฟลเดอร์ `backend/middleware/` เก็บ cross-cutting logic ของระบบ เช่น

- `auth.js`
- `optionalAuth.js`
- `dataMode.js`
- `asyncHandler.js`
- `notFound.js`
- `errorHandler.js`
- `requireRole.js`

แนวทางใช้งาน:

- middleware ด้าน auth/role ควรใช้ก่อน route ที่จำกัดสิทธิ์เสมอ
- error handling ควรรวมผ่าน `errorHandler` เพื่อให้ response มีรูปแบบเดียวกัน
- route ที่เป็น async ควรใช้ `asyncHandler` เพื่อลด try/catch ซ้ำ ๆ

รายละเอียดของ middleware ที่ใช้บ่อย:

- `auth.js`
  - ตรวจสอบ JWT จาก header `Authorization: Bearer <token>`
  - ถ้า token ไม่ถูกต้องจะตอบ `401`

- `dataMode.js`
  - เลือก data mode จาก request
  - ผูก Prisma client ที่เหมาะสมไว้กับ `req.prisma`
  - ส่ง header บอก mode ที่ใช้งานกลับไป

- `asyncHandler.js`
  - ห่อ async controller ให้ส่ง error ไปที่ middleware กลางอัตโนมัติ

- `notFound.js`
  - ใช้ตอบกรณีเรียก route ที่ไม่มีอยู่

- `errorHandler.js`
  - ใช้จัดรูป error response ให้เป็นมาตรฐานเดียวกัน

### 5.8 การทำงานของ app entrypoint

backend แยก entrypoint ออกเป็น 2 ชั้น:

- `app.js`
  - สร้าง Express app และลง middleware/route ต่าง ๆ
  - เหมาะกับการใช้ใน integration test หรือการนำไป embed ใน runner อื่น

- `server.js`
  - ใช้สำหรับ start server จริง
  - เรียก `app` แล้ว bind port ตามตัวแปร `PORT`
  - ในโปรเจกต์นี้ยังเรียก `dbInit` ตอนเริ่มต้นเพื่อช่วยจัดการ schema drift ในโหมด local/dev

### 5.9 แนวทางพัฒนา Backend

- API ใหม่ควรจัดเข้ากับ feature ที่เกี่ยวข้อง
- route/controller/service/model ควรอยู่ใน feature เดียวกัน
- business logic ไม่ควรอยู่หนาแน่นใน controller
- logic ที่ reuse ได้หรือ test ง่ายควรแยกเป็น helper/service
- การ query ฐานข้อมูลควรสื่อชื่อให้ชัดและผูกกับ domain
- ถ้า endpoint ใหม่เกี่ยวข้องกับ blockchain ควรแยก responsibility ระหว่าง transaction service, blockchain service และ persistence layer ให้ชัด
- ควรใช้ Prisma client ที่โปรเจกต์เตรียมไว้ ไม่สร้าง client ซ้ำโดยไม่จำเป็น
- ค่าที่เกี่ยวกับ auth และการรัน service ควรมาจาก root `.env` เป็นหลัก

### 5.10 จุดที่ควรรู้เวลาเพิ่ม API ใหม่

เมื่อจะเพิ่ม endpoint ใหม่ใน backend ควรเช็ค 4 จุดนี้ก่อน:

1. Route ควรอยู่ใน feature ที่เหมาะสมหรือไม่
2. ต้องใช้ auth หรือ role guard หรือไม่
3. ต้องอ่าน/เขียนข้อมูลผ่าน Prisma model ไหน
4. Endpoint นี้มีผลกับ blockchain, dashboard หรือ side effect อื่นหรือไม่

---

## 6. คู่มือ Database สำหรับผู้พัฒนา

สำหรับรายละเอียดเชิงลึกของการใช้งาน PostgreSQL + Prisma (โครงสร้าง schema, migration workflow, backup/restore, troubleshooting) ให้ดูเอกสารเพิ่มเติมที่:

- `DATABASE_DEVELOPER_MANUAL.md`

### 6.1 เทคโนโลยี

- PostgreSQL
- Prisma

### 6.2 โครงสร้างที่เกี่ยวข้อง

```text
backend/prisma/
backend/utils/prisma.js
backend/db_migrations/
```

### 6.3 ลักษณะข้อมูลหลักของระบบ

ฐานข้อมูลเก็บข้อมูลสำคัญของระบบ เช่น

- ผู้ใช้และ role
- อาคาร
- มิเตอร์
- wallet และ token balance
- running meter logs
- hourly/daily/weekly/monthly aggregates
- offer และ marketplace transactions
- invoice และ receipt
- blockchain verification metadata

### 6.4 การอัปเดต schema

สำหรับ development:

```bash
npx prisma db push
npx prisma generate
```

สำหรับ environment ที่ใช้ Docker:

- dev compose มีการรัน Prisma ตอนเริ่ม service
- EC2 compose สามารถควบคุมได้ผ่านตัวแปรเช่น `RUN_PRISMA_DB_PUSH`

### 6.5 หมายเหตุ

- `prisma generate` ไม่แก้ข้อมูลใน database
- `db push` หรือ migration เป็นคำสั่งที่มีผลต่อ schema จริง
- ควรสำรองข้อมูลก่อน schema change ใน environment สำคัญ

---

## 7. คู่มือ Blockchain Layer สำหรับผู้พัฒนา

### 7.1 เทคโนโลยี

- Hardhat
- Solidity contracts
- Ethers.js / Web3

### 7.2 โครงสร้างหลัก

```text
blockchain/
  contracts/
  scripts/
  hardhat.config.js
```

### 7.3 บทบาทของ blockchain ในระบบ

ระบบใช้ blockchain สำหรับ

- publish payload hash ของ transaction
- บันทึก verification metadata
- ใช้ตรวจสอบความถูกต้องของข้อมูล transaction/receipt

### 7.4 การเชื่อมต่อจาก backend

backend รองรับตัวแปร environment เช่น

- `ETH_RPC_URL`
- `ETH_PRIVATE_KEY`
- `ETH_CHAIN_ID`
- `ETH_EXPLORER_BASE_URL`
- `ETH_VERIFICATION_CONTRACT_ADDRESS`

เมื่อมี transaction verification ระบบจะคำนวณ payload hash แล้วบันทึกลง chain หรือเรียก contract ตาม configuration

---

## 8. คู่มือ Testing สำหรับผู้พัฒนา

โปรเจกต์นี้มีทั้ง unit test และ integration test

### 8.1 Frontend tests

```text
frontend/src/unit_test/
frontend/src/integration_test/
```

ตัวอย่างสิ่งที่ครอบคลุม:

- chart helpers
- meter analytics
- invoice/receipt mapper
- auth/session helper
- login flow
- invoice payment flow
- approved request flow
- mock energy flow

### 8.2 Backend tests

```text
backend/unit_test/
backend/integration_test/
```

ตัวอย่างสิ่งที่ครอบคลุม:

- invoice helpers
- rate fallback helpers
- app health integration

### 8.3 แนวทางการเพิ่ม test

- helper logic ควรเขียนเป็น unit test
- page flow หรือ API flow ควรเขียนเป็น integration test
- ควรแยก pure function ออกมาก่อนถ้าต้องการให้ test ง่าย

---

## 9. คู่มือ Docker และ Deployment

### 9.1 Docker Compose files ที่มีในระบบ

- `docker-compose.dev.yml`
  - ใช้สำหรับ development
  - รองรับ hot reload

- `docker-compose.yml`
  - ใช้สำหรับ Docker production-style พื้นฐาน

- `docker-compose.ec2.yml`
  - ใช้สำหรับ deploy แบบ single-server บน EC2

### 9.2 EC2 deployment

ดูรายละเอียดเต็มได้ในไฟล์:

- `DEPLOY_EC2.md`

แนวทางนี้จะรัน:

- `frontend`
- `backend`
- `postgres`
- `blockchain`

ไว้บนเครื่องเดียว เหมาะกับ demo, thesis, และ project showcase

---

## 10. ตัวแปร Environment สำคัญ

### 10.1 Frontend

ตัวอย่างเช่น

- `REACT_APP_API`
- `REACT_APP_API_BASE`
- `REACT_APP_APIURL`
- `REACT_APP_MOCKUPMODE`

### 10.2 Backend

ตัวอย่างเช่น

- `PORT`
- `SECRET_KEY`
- `DATABASE_URL`
- `DATABASE_URL_DEMO`
- `DEFAULT_DATA_MODE`

หมายเหตุ: ค่าที่ใช้กับระบบควรถูกกำหนดจาก root `.env` เท่านั้น ไม่ควรสร้าง `.env` ซ้ำใน `backend/prisma/` หรือ `frontend/`
- `ETH_RPC_URL`
- `ETH_PRIVATE_KEY`
- `ETH_CHAIN_ID`
- `ETH_EXPLORER_BASE_URL`
- `ETH_VERIFICATION_CONTRACT_ADDRESS`

### 10.3 Deployment

ตัวอย่างใน `.env.ec2.example`

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `FRONTEND_URL`
- `RUN_PRISMA_DB_PUSH`
- `RUN_PRISMA_MIGRATE`

---

## 11. แนวทางการเริ่มพัฒนาระบบ

### 11.1 Local development แบบ Docker

```bash
docker compose -f docker-compose.dev.yml up --build
```

### 11.2 รัน Prisma

```bash
npx prisma db push
npx prisma generate
```

### 11.3 รัน test

backend:

```bash
cd backend
npm run test:unit
npm run test:integration
```

frontend:

```bash
cd frontend
npm run test:unit
npm run test:integration
```

---

## 12. แนวทางสำหรับนักพัฒนาที่เข้าร่วมโปรเจกต์ใหม่

นักพัฒนาที่เริ่มต้นกับโปรเจกต์นี้ควรอ่านและทำความเข้าใจตามลำดับดังนี้

1. อ่าน `README.md`
2. อ่าน `DEVELOPER_MANUAL.md`
3. ดู `docker-compose.dev.yml` และ `docker-compose.ec2.yml`
4. สำรวจ `frontend/src/pages` และ `backend/features`
5. ตรวจสอบ route และ API connector ที่เกี่ยวข้องกับ feature ที่จะพัฒนา
6. รันระบบใน dev mode และลอง flow สำคัญ เช่น login, dashboard, market, invoice
7. เพิ่ม test สำหรับ logic ใหม่ก่อน merge

---

## 13. สรุป

ระบบ NIDA Smart Grid Energy Trading and Management System เป็น full-stack application ที่รวมหลาย domain เข้าด้วยกัน ได้แก่ energy monitoring, wallet and billing, marketplace, blockchain verification, analytics, และ deployment workflow

การจัดโครงสร้างปัจจุบันของระบบเน้น:

- frontend แบบ page/domain-based
- backend แบบ feature-based
- database ผ่าน Prisma + PostgreSQL
- blockchain verification แยกเป็น layer ชัดเจน
- รองรับ unit test, integration test และ Docker-based deployment

เอกสารฉบับนี้ควรอัปเดตทุกครั้งที่มีการเปลี่ยนแปลง architecture, folder structure, route สำคัญ หรือ deployment flow ของระบบ
