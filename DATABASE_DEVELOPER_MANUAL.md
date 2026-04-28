# คู่มือ Database สำหรับผู้พัฒนา
# NIDA Smart Grid Energy Trading and Management System

เอกสารนี้อธิบายการทำงานของฐานข้อมูลในโปรเจกต์นี้สำหรับนักพัฒนา โดยระบบใช้ PostgreSQL + Prisma

หมายเหตุ: โปรเจกต์นี้ใช้ `.env` ที่ root เป็นแหล่งข้อมูลกลางเพียงจุดเดียว สำหรับทั้ง Docker Compose, backend, frontend build arguments และการรัน Prisma CLI จากเครื่อง host

---

## 1) โครงสร้างของ Database

ระบบฐานข้อมูลของโปรเจกต์นี้ทำงานบน Docker Container และแยกข้อมูลจริงเก็บไว้ที่ Docker Volume เพื่อให้ข้อมูลคงอยู่แม้ container ถูกสร้างใหม่

องค์ประกอบหลัก:
- Database Engine: PostgreSQL 16 (`postgres:16-alpine`)
- ORM/Schema Management: Prisma
- DB Admin UI: pgAdmin 4
- Persistent Storage: named volume `postgres_data`

พฤติกรรมสำคัญ:
- หาก `docker compose down` อย่างเดียว: ข้อมูลยังคงอยู่
- หาก `docker compose down -v`: ข้อมูลใน volume จะถูกลบ

ไฟล์ที่เกี่ยวข้อง:
-- `docker-compose.yml`
-- `database/schema.prisma`
-- `database/migrations/`
-- `backend/utils/prisma.js`

---

## 2) ภาพรวม Architecture การเชื่อมต่อ

ลำดับการเชื่อมต่อข้อมูล:
1. Frontend เรียก API ไปที่ Backend
2. Backend ใช้ Prisma Client query ไปยัง PostgreSQL
3. PostgreSQL จัดเก็บข้อมูลหลักของระบบ เช่น ผู้ใช้ อาคาร มิเตอร์ พลังงาน ธุรกรรม และเอกสาร billing

Container/service หลักที่เกี่ยวข้องกับ DB:
- `db` (PostgreSQL)
- `backend` (Express + Prisma)
- `pgadmin` (UI สำหรับตรวจสอบและ query)

---

## 3) โครงสร้างข้อมูลหลัก (Domain Data Model)

โมเดลหลักใน `schema.prisma` แบ่งได้เป็นกลุ่มดังนี้:

- User/Auth
- `User`, `UserCredential`

- Building/Meter
- `Building`, `MeterInfo`

- Energy Aggregation
- `RunningMeter`, `HourlyEnergy`, `DailyEnergy`, `WeeklyEnergy`, `MonthlyEnergy`

- Trading/Billing/Wallet
- `Wallet`, `Transaction`, `EnergyOffer`, `Invoice`, `Receipt` (รวมถึง relation ที่เกี่ยวข้อง)

- Blockchain Verification Metadata
- ฟิลด์/ตารางที่เก็บสถานะ verification และ tx hash จาก Ethereum layer

นอกจากนี้มี enum สำคัญ เช่น:
- `UserRole`
- `TxStatus`
- `EnergyOfferStatus`

---

## 4) Environment Variables ที่เกี่ยวกับ Database

ค่า default สำคัญ (จาก `docker-compose.yml`):
- `POSTGRES_DB=energy_trading`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=admin123`
- `POSTGRES_PORT=5432`

Backend จะใช้ `DATABASE_URL` ภายใน network ของ Docker Compose:
- host = `db`
- port = `5432`

ตัวอย่างค่าใน container backend:
- `postgresql://postgres:admin123@db:5432/energy_trading?schema=public`

หมายเหตุ:
- คำว่า `localhost` ใช้สำหรับรันคำสั่งจากเครื่อง host เท่านั้น
- ภายใน container ต้องใช้ชื่อ service `db` แทน `localhost`

---

## 5) การเริ่มต้นระบบฐานข้อมูล (First Run)

จาก root ของโปรเจกต์:

```bash
docker compose up --build
```

ผลลัพธ์ที่ควรได้:
- PostgreSQL ทำงานที่ `localhost:5432`
- pgAdmin ทำงานที่ `http://localhost:5050`
- backend เชื่อมต่อฐานข้อมูลได้

หากต้องการตรวจสอบ DB ตรงๆ:

```bash
docker compose exec db psql -U postgres -d energy_trading
```

---

## 6) การจัดการ Schema ด้วย Prisma

โปรเจกต์นี้ใช้ Prisma เป็นตัวจัดการ schema และ migrations

### 6.1 กรณีพัฒนาแบบ local/รวดเร็ว

```bash
cd backend
npx prisma db push
npx prisma generate
```

ก่อนรันคำสั่ง Prisma จากเครื่อง host ให้แน่ใจว่า env จาก root `.env` ถูกโหลดเข้ามาแล้ว หรือรันคำสั่งจาก root ด้วย environment ที่มีค่า `DATABASE_URL` พร้อมใช้งาน

เหมาะสำหรับ:
- ปรับ schema ระหว่างพัฒนา
- ยังไม่ต้องการเก็บ migration history แบบละเอียด

### 6.2 กรณีใช้งาน migration แบบเป็นระบบ

```bash
cd backend
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

เหมาะสำหรับ:
- ทำงานร่วมกันหลายคน
- ต้องการเก็บประวัติการเปลี่ยน schema ในโฟลเดอร์ `backend/prisma/migrations/`

### 6.3 สำหรับ environment production/deploy

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

ใน Docker image ปัจจุบัน backend จะรัน:
- `prisma db push`
- `prisma generate`
- และถ้า `RUN_PRISMA_MIGRATE=true` จะรัน `prisma migrate deploy` เพิ่ม

---

## 7) แนวทางการแก้ไข Schema อย่างปลอดภัย

แนะนำ workflow:
1. แก้ schema ใน `database/schema.prisma`
2. รัน `npx prisma migrate dev --name <name>`
3. รันระบบและทดสอบ API ที่เกี่ยวข้อง
4. ตรวจสอบผลใน pgAdmin
5. commit ทั้งไฟล์ schema และโฟลเดอร์ migration

ข้อควรระวัง:
- หลีกเลี่ยง `--accept-data-loss` ใน environment สำคัญ
- ก่อนปรับ schema ใหญ่ ควร backup ฐานข้อมูลก่อนเสมอ

---

## 8) การสำรองและกู้คืนข้อมูล (Backup/Restore)

### 8.1 Backup

```bash
docker compose exec db pg_dump -U postgres -d energy_trading > backup.sql
```

### 8.2 Restore

```bash
docker compose exec -T db psql -U postgres -d energy_trading < backup.sql
```

หมายเหตุ:
- ใช้ไฟล์ backup จาก version schema ที่สอดคล้องกัน
- ควร restore ใน environment ทดสอบก่อน production

---

## 9) Troubleshooting ที่พบบ่อย

### 9.1 Prisma Error `P1000` (Authentication failed)

สาเหตุที่พบบ่อย:
- เปลี่ยน `POSTGRES_PASSWORD` หลังจาก volume ถูกสร้างแล้ว

วิธีแก้:
```bash
docker compose down -v
docker compose up --build
```

คำเตือน: คำสั่งนี้ลบข้อมูลใน volume เดิมทั้งหมด

### 9.2 Backend ต่อ DB ไม่ได้

ตรวจสอบ:
- service `db` ขึ้นสถานะ healthy หรือไม่
- ค่า `DATABASE_URL` ใน backend ชี้ไปที่ `db:5432`
- user/password/db name ตรงกับ PostgreSQL จริง

### 9.3 Prisma Client ไม่ตรงกับ schema ล่าสุด

รัน:
```bash
cd backend
npx prisma generate
```

---

## 10) มาตรฐานการพัฒนาฝั่ง Database

แนวทางที่แนะนำสำหรับทีม:
- ใช้ Prisma model naming ให้สอดคล้องกับ domain จริง
- เพิ่ม relation/index ใน schema ให้ชัดเจนตั้งแต่แรก
- ทุกการเปลี่ยน schema ต้องมีการทดสอบ API ที่เกี่ยวข้อง
- ไม่ query ข้าม domain มั่วใน controller; จัด logic ใน service/model ตาม feature
- เอกสาร schema change ควรระบุผลกระทบต่อข้อมูลเก่าเสมอ

---

## 11) เครื่องมือที่ทีมควรใช้ร่วมกัน

- Prisma Studio (ดูข้อมูลแบบรวดเร็ว)
```bash
cd backend
npx prisma studio
```

- pgAdmin (ดู query, schema, index, execution)
- Docker logs (ตรวจสอบข้อผิดพลาดตอน start container)
```bash
docker compose logs -f db
docker compose logs -f backend
```

---

## 12) สรุป

ระบบฐานข้อมูลของโปรเจกต์นี้ใช้ PostgreSQL + Prisma โดยออกแบบให้:
- รันง่ายผ่าน Docker Compose
- ข้อมูลคงอยู่ด้วย named volume
- ควบคุม schema ได้ทั้งแบบเร็ว (`db push`) และแบบมีประวัติ (`migrate`)
- รองรับงานพัฒนาและ deployment ผ่าน workflow เดียวกัน

หากเป็นงานที่มีผลต่อข้อมูลจริง ให้ใช้ migration + backup ก่อนทุกครั้งเพื่อความปลอดภัย
