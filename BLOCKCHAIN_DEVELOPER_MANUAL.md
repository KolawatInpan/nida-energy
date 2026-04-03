# คู่มือ Blockchain สำหรับนักพัฒนา

เอกสารนี้อธิบายการทำงานของระบบยืนยันธุรกรรมบนบล็อกเชน (blockchain verification) ในโปรเจกต์นี้ รวมถึงวิธีรันระบบ การตั้งค่า และการแก้ปัญหาระหว่างพัฒนา

## 1. ขอบเขตและเป้าหมาย

เลเยอร์ blockchain ถูกใช้เพื่อพิสูจน์ว่าธุรกรรมของแอปถูกยืนยันแล้ว โดยนำค่า hash ของ payload ไปบันทึกบนเชน

ปัจจุบันรองรับการ publish 2 โหมด:

- `self-transaction`: ส่งธุรกรรมมูลค่า 0 กลับไปยัง signer เดิม และใส่ hash ไว้ในฟิลด์ `data`
- `contract-event`: เรียก `VerificationRegistry.recordVerification(appTxId, payloadHash)` เพื่อให้ contract emit event โดยตรง

แม้จะยังไม่เปิดการ publish ขึ้นเชน backend ก็ยังรองรับโหมด preview ได้

## 2. องค์ประกอบสำคัญ

- Hardhat workspace: `blockchain/`
- Contract: `blockchain/contracts/VerificationRegistry.sol`
- Deploy script: `blockchain/scripts/deploy-verification-registry.js`
- Engine สำหรับ verification: `backend/features/blockchain/ethereumVerification.service.js`
- Service ควบคุม flow การ verify: `backend/features/blockchain/transactionVerification.service.js`
- Endpoint ของ transaction: `backend/features/transactions/transaction.routes.js`

## 3. ตัวแปรแวดล้อม (Environment Variables)

### 3.1 จำเป็นสำหรับการ publish ขึ้นเชน

- `ETH_RPC_URL`
- `ETH_PRIVATE_KEY`

ถ้าขาดค่าใดค่าหนึ่ง endpoint สำหรับ publish จะคืนผลแบบ preview/non-published

### 3.2 ค่าเสริม (Optional)

- `ETH_CHAIN_ID` (ค่า default ใน backend คือ `11155111`)
- `ETH_EXPLORER_BASE_URL` (ถ้าไม่กำหนด backend จะเดา default สำหรับ Sepolia/Mainnet)
- `ETH_VERIFICATION_CONTRACT_ADDRESS` (เมื่อกำหนดแล้วจะใช้โหมด `contract-event`)

### 3.3 นโยบายค่า default ใน repo นี้

สำหรับ backend ที่รันใน Docker Compose ค่า RPC ถูกล็อกเป็น:

- `http://blockchain:8545`

เพื่อป้องกันปัญหา container ชี้ localhost ภายในตัวเอง (`127.0.0.1:8545`)

## 4. การรันแบบ Host vs Docker

### 4.1 Backend รันบนเครื่อง host

ใช้ local hardhat endpoint:

- `ETH_RPC_URL=http://127.0.0.1:8545`
- `ETH_CHAIN_ID=31337`

### 4.2 Backend รันใน Docker Compose

ห้ามใช้ localhost ภายใน container และต้องใช้ service DNS:

- `ETH_RPC_URL=http://blockchain:8545`

## 5. ขั้นตอนพัฒนาในเครื่อง (Local Development Flow)

### 5.1 เริ่ม local chain (โหมด host)

```bash
cd blockchain
npm install
npm run node
```

Hardhat จะเปิด JSON-RPC ที่ `127.0.0.1:8545` พร้อมบัญชีทดสอบและ private key ที่เติมเงินไว้แล้ว

### 5.2 Compile และ deploy contract (ไม่บังคับ)

```bash
cd blockchain
npm run compile
npm run deploy:local
```

ไฟล์ผลลัพธ์ deployment:

- `blockchain/deployments/localhost.json`

ถ้าต้องการใช้โหมด contract ให้คัดลอก address ไปใส่ env:

- `ETH_VERIFICATION_CONTRACT_ADDRESS=0x...`

### 5.3 เริ่มระบบทั้งชุดด้วย Docker

```bash
docker compose -f docker-compose.dev.yml up --build
```

## 6. Verification API (Backend)

base path ของ route คือ `/api/transactions`

### 6.1 ดู preview ของ verification payload

- `GET /api/transactions/:id/verification-preview`

ผลลัพธ์จะมี payload, payload hash, chain setting, method และสถานะว่า publish ได้หรือไม่

### 6.2 Publish verification ขึ้นเชน

- `POST /api/transactions/:id/verify`
- ตัวเลือกบังคับ verify ใหม่:
  - Query: `?force=true`
  - Body: `{ "force": true }`

พฤติกรรม response:

- `201` เมื่อ publish ขึ้นเชนสำเร็จ
- `200` เมื่อยังเป็น preview-only/non-published

## 7. วิธีคำนวณ proof ใน backend

ไฟล์หลัก: `backend/features/blockchain/ethereumVerification.service.js`

สรุป flow:

1. สร้าง canonical payload จากข้อมูล transaction ของแอป
2. สร้าง hash ด้วย `ethers.id(JSON.stringify(payload))`
3. ถ้ามี contract address จะเรียก `recordVerification(...)`
4. ถ้าไม่มี จะ fallback เป็น self-transaction โดยส่ง hash ผ่าน `data`
5. รอ receipt แล้วเติม metadata (block number/hash, gas, explorer URL)
6. บันทึกสถานะ verification และ metadata กลับฐานข้อมูล

## 8. การบันทึกข้อมูล (Persistence Model)

metadata ของ verification จะถูกบันทึกกลับ `Transaction` ผ่าน:

- `backend/features/transactions/transaction.model.js` (`updateVerification`)

เมื่อ publish สำเร็จและมี tx hash จะ upsert ลง `BlockTransaction` ผ่าน:

- `backend/features/blockchain/blockTransaction.model.js` (`upsertFromVerification`)

## 9. การแก้ปัญหาที่พบบ่อย (Troubleshooting)

### 9.1 `connect ECONNREFUSED 127.0.0.1:8545` ขณะรัน Docker

สาเหตุ:

- backend container พยายามต่อ `localhost` แทนที่จะต่อ service DNS

วิธีแก้:

- ยืนยันว่า backend ใน compose ใช้ `ETH_RPC_URL=http://blockchain:8545`
- สร้าง container ใหม่:

```bash
docker compose down
docker compose up -d --build
```

### 9.2 Publish แล้วได้ผล preview-only

สาเหตุ:

- ไม่มี `ETH_RPC_URL` หรือ `ETH_PRIVATE_KEY`

วิธีแก้:

- ตั้งค่าให้ครบทั้งสองตัวใน runtime environment ของ backend

### 9.3 ลิงก์ explorer ไม่ถูกต้อง

สาเหตุ:

- `ETH_EXPLORER_BASE_URL` ไม่ตรงกับ chain ที่ใช้งาน

วิธีแก้:

- กำหนด explorer base URL ให้ตรงกับ chain ที่ต้องการ

### 9.4 เรียก contract แล้ว revert หรือ fail

รายการตรวจสอบ:

- contract ถูก deploy อยู่บน network เดียวกับ `ETH_RPC_URL` และ `ETH_CHAIN_ID`
- `ETH_VERIFICATION_CONTRACT_ADDRESS` ชี้ไปที่ `VerificationRegistry` ที่ deploy แล้ว
- signer มี native token พอสำหรับจ่าย gas

## 10. ข้อแนะนำด้านความปลอดภัย

- ห้าม commit private key สำหรับ production
- ใช้ key แยกสำหรับ local/dev ที่มีความเสี่ยงต่ำ
- ใน production ควรใช้ secret manager แทนการเก็บค่า plaintext ใน `.env`
- หมุน key ทันทีหากมีโอกาสรั่วไหล

## 11. เช็กลิสต์สำหรับนักพัฒนาใหม่

1. ติดตั้ง dependency ใน `blockchain/`
2. เริ่ม Hardhat node (`npm run node`) หรือรันผ่าน Docker stack
3. ตั้งค่า backend ด้วย `ETH_PRIVATE_KEY` และ `ETH_RPC_URL` ให้ถูกต้อง
4. ทดสอบเรียก preview endpoint
5. ทดสอบเรียก verify endpoint และตรวจว่า `published: true` พร้อม `txHash`
6. (ไม่บังคับ) deploy contract และตั้ง `ETH_VERIFICATION_CONTRACT_ADDRESS` เพื่อใช้ event mode
