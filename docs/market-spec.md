# Market Spec — Day-Ahead & Intraday

เวอร์ชัน: 0.1
วันที่: 2026-05-19
ผู้เขียน: ทีมพัฒนา

## วัตถุประสงค์
กำหนดกฎการทำงานของระบบตลาดพลังงานภายในระบบ (Day-Ahead และ Intraday) สำหรับให้ผู้ใช้ส่งคำสั่ง Bid (ซื้อ) และ Offer (ขาย) และสำหรับใช้เป็นฐานการพัฒนา matching engine, API และ UI

---

## Terminology
- Order: คำสั่งซื้อหรือขาย (Bid / Offer)
- Bid: คำสั่งซื้อ (ผู้ขอซื้อพลังงาน) — มี `price`, `quantity(kWh)`, `participantId`, `buildingId`, `sourceType` (e.g., battery, load)
- Offer: คำสั่งขาย (ผู้เสนอขายพลังงาน) — มี `price`, `quantity(kWh)`, `participantId`, `buildingId`, `sourceType` (e.g., solar, battery)
- Match: ผลการจับคู่ระหว่าง Bid/Offer (matched quantity, price, buyer, seller)
- Market Run / Session: รอบตลาด (วัน/ช่วงเวลาที่กำหนด)

---

## Schedule (Day-Ahead, manual entry)
- เปิดรับคำสั่ง: 06:00 - 17:59 (local time)
- ปิดรับคำสั่งชั่วคราว (lock for pre-match): 18:00 — เริ่มจับคู่ครั้งแรก (pre-match)
- ปิดรับคำสั่งสุดท้ายและจับคู่รอบสุดท้าย: 24:00 — final matching
- Market Clear: 05:00 ของวันถัดไป — ปิดการคำนวณราคาและสรุปผล (settlement)
- 06:00 เปิดรอบตลาดใหม่

หมายเหตุ: เวลาทั้งหมดเป็น local server timezone — จะต้องใช้ scheduler (cron / job queue) เพื่อปิด/เปิดและเรียก run-match

---

## Order model (ตัวอย่าง field)
- id
- type: 'bid' | 'offer'
- participantId
- buildingId
- sourceType: 'solar' | 'battery' | 'grid' | 'load'
- quantity_kwh (decimal)
- price (decimal) — THB/kWh หรือหน่วยที่ตกลง
- createdAt, updatedAt
- validity: optional window
- status: open | cancelled | matched | expired
- metadata: e.g., battery SoC snapshot, monthly consumption/battery stats

---

## Matching logic (priority-based)
ลำดับการแจกพลังงาน (Priority):

1) Priority สูงสุด — Battery และ Solar จาก `same building`
   - ถ้ามี Offer (เช่น Solar A หรือ Battery A) และมี Bid จากตึกเดียวกัน (Building A) ให้จับคู่ก่อน
   - Baseline price = 3.5
     - สำหรับ Bid ให้ยอมรับเฉพาะ Bid ที่ `price >= 3.85`
     - สำหรับ Offer ให้ยอมรับเฉพาะ Offer ที่ `price < 4`
   - หมายเหตุ: เงื่อนไข baseline เป็นเกณฑ์กรองสำหรับการจับคู่ Priority-1

2) Priority-2 — คำสั่งซื้อที่ให้ราคา (Bid Price) สูงที่สุด จะได้ไฟที่เหลือจากขั้นตอน (1)
   - คำสั่ง Offer ที่เหลือจะถูกจับคู่กับ Bid ที่มีราคาแพงสุดก่อน (descending by price)

3) Priority-3 — Tie-breaker เมื่อ Bid Price เท่ากัน
   - ถ้า Bid price เท่ากัน ให้สิทธิ์กับ Building ที่มี `current battery kWh` ต่ำที่สุด (เพื่อชาร์จเติมแบตที่ต่ำ)

4) Extreme case: มีเฉพาะ Offers และไม่มี Bid
   - ระบบจะ `force` ส่งพลังงานไปยังตึกเป้าหมายตาม priority ภายในเดือน:
     - คัดเลือกตึกที่มี (Battery + consumption) สูงสุดใน 1 เดือน (monthly aggregate)
     - ส่งไปตามลำดับจนหมด Offer

---

## Price settlement
- Matching price: ใช้นโยบาย `price-from-seller-or-buyer` (เลือกนโยบายหนึ่ง)
  - Implementation suggestion: ใช้ `clearing price` = price of matched bid (or offer) — ระบุชัดเจนตอน implement
- Market Clear (05:00): สร้าง settlement record (`market_run`) และ lock การเปลี่ยนแปลง

---

## Battery-specific rules
- ถ้า Battery และ Solar อยู่ในตึกเดียวกัน (co-located):
  - Battery มี priority สูงกว่าให้อ้างอิงโดยให้ `effective cost` ของ Battery จากตึกเดียวกันถูกกว่า Solar จากตึกอื่น (หรือใช้ priority-1 rule)
  - ในการตัดสินใจเลือกแหล่งพลังงานให้พิจารณา SoC, charge/discharge limits และ throughput

---

## Intraday (Read-only / Manual)
- Intraday market จะแสดง order book ปัจจุบันและ matched trades แต่จะอนุญาตให้แก้ไข/ส่งคำสั่งเฉพาะผ่าน UI แบบ manual (หากต้องการ)
- Rate ใน Intraday สูงกว่า Day-Ahead (เพราะไม่เตรียมการล่วงหน้า) — สามารถแสดง recommended price uplift

---

## Edge cases
- Partial fills: หาก Offer/Bid ปริมาณไม่พอให้ fill ทั้งหมด ให้สร้าง match record partial และให้ remaining order ยังคงอยู่ (จนถึงเวลาปิด)
- Cancels: ผู้ใช้สามารถยกเลิกคำสั่งได้ถ้ายัง `open` ก่อน cutoff (18:00)
- Rounding: quantity และ price ควรมี precision ระบุ (e.g., 3 decimals)

---

## API surface (initial)
- POST `/api/market/orders` — submit Bid/Offer
- GET `/api/market/orders` — list orders (filter by type, buildingId, participantId, status)
- POST `/api/market/orders/:id/cancel` — cancel
- GET `/api/market/status` — market status (open/locked/matching/cleared)
- POST `/api/market/run-match` — trigger matching (admin / scheduler)
- GET `/api/market/matches` — recent matches
- GET `/api/market/runs` — past market_run records

---

## Data model suggestions (Prisma)
- market_orders
- market_matches
- market_runs (session metadata, start/stop times)
- participants / buildings ref (existing tables)

---

## Tests & validation
- Simulator utility to create synthetic Bid/Offer sets and assert matches for priority scenarios
- Unit tests for match engine (priority layers, tie-breakers, extreme cases)

---

## Implementation notes
- Implement matching engine as separate service/class to allow deterministic testing
- Use job queue (Bull/Redis) or cron to schedule runs at 18:00/24:00/05:00/06:00
- For immediate demo: provide manual admin endpoint to trigger runs

---

## Next steps
1. Design DB schema and Prisma models
2. Implement API + controller for orders
3. Implement matching engine with unit tests
4. Create minimal UI pages for Day-Ahead order entry and Intraday dashboard



