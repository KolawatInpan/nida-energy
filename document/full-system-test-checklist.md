# Full-System Test Checklist (NIDA Energy Trading)

> เช็คลิสต์ทดสอบระบบเต็ม ตั้งแต่เริ่มยันจบ — รันตามลำดับขั้น
> แต่ละขั้นอ้างอิง backend endpoint / logic ที่เกี่ยวข้องกันตามลูกโซ่

## 0. Precondition

- [ ] Docker dev stack รันอยู่: `docker compose -f docker-compose.dev.yml up -d`
- [ ] Backend logs ไม่มี crash loop: `docker compose -f docker-compose.dev.yml logs -f backend`
- [ ] Login admin ได้: password `nidaadmin1` (หรือ `nidaadmin2` สำหรับ Energy Manager)
- [ ] Database mode REAL (`x-data-mode: REAL` แสดงใน header ของ request)

## 1. Registration & User

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 1.1 | Bulk register ที่ `/meter-registration`: ปุ่ม Buildings → Meters → Users | สร้างครบ 11 ตึก / meters / users, users ผูก BuildingAssignment + wallet อัตโนมัติ |
| 1.2 | Register ชื่อที่มีอยู่แล้ว (manual) | ได้ 409 `"User name ... already exists"` (identity guard) |
| 1.3 | OTP: 2 คนกรอกฟอร์มพร้อมกัน (email เดียวกัน, ชื่อต่างกัน) | OTP ไม่ทับกัน — keyed ด้วย email+name |
| 1.4 | Login user ด้วย shared email + password ของตัวเอง | เข้าได้เฉพาะบัญชีที่ password ตรง |
| 1.5 | พยายามแก้ email ของ user (PUT /users/:credId) | ได้ 400 — email แก้ไม่ได้ใน shared-email model |
| 1.6 | `GET /api/users/<email>` | ได้ 400 พร้อมข้อความให้ใช้ credId (legacy path ถูกปิด) |

## 2. Building / Meter / Wallet

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 2.1 | เปิดหน้า building รายตึก | แสดง Contact: Name + Email + Phone (แถวเดียว) |
| 2.2 | เปิด `/wallet/<building>` | เห็น wallet ของตึกนั้น (ผูกด้วย buildingId ไม่ใช่ email) |
| 2.3 | สร้าง offer โดยตึกไม่มี meter ต้นทาง | ได้ error "meter not found" — ไม่สร้าง offer |

## 3. เติมเงิน (Top-up)

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 3.1 | เติม 5,000 เข้า building wallet | balance เพิ่มทันที |
| 3.2 | เช็ค DB หลัง top-up | มี WalletTx(+5,000) + Invoice(SYSTEM→wallet, kWH=0, paid) + Receipt + Transaction(CREDIT) |
| 3.3 | เปิดหน้า market ทันที | ยอด token ของตึกแสดง 5,000 (ไม่ติด 0) |
| 3.4 | ยอดเกินบัลลานซ์เชิงบัญชี: รวม Wallet ทุกใบ = รวม WalletTx | ✅ (reconciliation) |

## 4. Manual Trade (ซื้อขายตรง)

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 4.1 | ตึก A สร้าง offer (solar 100 kWh @ 3) | Offer ขึ้น AVAILABLE, meter ต้นทางถูกจอง logic |
| 4.2 | ตึก B ซื้อ 50 kWh เลือกปลายทาง = ตึก B | เงินตัด 150 จาก B, A ได้ 150 |
| 4.3 | เช็ค meter ตึก B หลังซื้อ | battery meter +50 (ถ้าไม่มี battery → consumer +50) |
| 4.4 | เช็ค meter ต้นทางตึก A | −50 ทั้ง value และ kWH |
| 4.5 | RunningMeter | มี log source=MARKET ฝั่ง B, source=SOLD ฝั่ง A |
| 4.6 | ซื้อเกินยอดใน wallet | ได้ error Insufficient balance (ทั้ง frontend และ backend เช็ค) |
| 4.7 | Sell to bid: ตึก A ขายเข้า bid ของ B | เหมือน 4.2–4.5, bid kWHBought เพิ่ม, FULFILLED เมื่อครบ |
| 4.8 | Invoice ในใบเดือนปัจจุบัน (billing list) | **ไม่**มีใบ purchase/sale ปน — ดูข้อ 7 |

## 5. Market Matching (Day-Ahead / Intraday)

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 5.1 | สร้าง bid (ตึก C ต้องการ 80 @ 3.5) + offer (ตึก A ขาย 100 @ 3) | matching จับคู่ 80 kWh |
| 5.2 | เช็คเงินหลัง match | C ตัด 280, A ได้ 266 (หัก fee 5%) |
| 5.3 | เช็ค meter ตึก C | battery (หรือ fallback consumer) +80 |
| 5.4 | Bid จากตึกที่ไม่มี meter รับพลังงาน | ถูก skip พร้อม log (ไม่ตัดเงิน) |
| 5.5 | Force distribution | เหลือ offer ไม่ขาย → ถูกดันเข้าตึกมี battery ที่ penalty price หรือย้ายเป็น INTRADAY |
| 5.6 | MarketRun / MarketMatch records | มี run completed + match rows ครบ |

## 6. พลังงาน & Dashboard

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 6.1 | Energy feed cron / mock cron วิ่ง | RunningMeter → Hourly/Daily/Monthly aggregate เพิ่ม |
| 6.2 | Dashboard ตึกผู้ซื้อ | กราฟสะท้อนพลังงานที่ซื้อเพิ่ม |
| 6.3 | Battery charge source breakdown | แยก SOLAR / MARKET ได้ |

## 7. Invoice (ใบกำกับรายเดือน) — เงื่อนไขการสร้าง

### กติกาปัจจุบัน

1. **ใบกำกับรายเดือน (utility bill)** — สร้างเมื่อ **มีการ consume ในเดือนนั้น** (DailyEnergy ของ consume meter > 0)
   - ทริกเกอร์: (a) กด Generate ที่หน้า invoice (b) เปิดหน้า invoice/summary วันที่ 1 ของเดือน → auto สร้างย้อนเดือนก่อน (c) POST /invoices/generate
   - `fromWId = 'SYSTEM'`, `toWId = wallet ของตึก`, status unpaid, dueDate +15 วัน
2. **Billable = consume − marketPurchased** — พลังงานที่ซื้อจาก marketplace ถูก**หักออกจากค่าไฟ** (ซื้อมาแล้ว จ่ายค่าไฟซ้ำไม่ได้) โดยดึงจากใบ purchase ของเดือนนั้น
3. **ใบที่ไม่ใช่ใบกำกับ (ไม่ควรโผล่ใน invoice list):**
   - ใบจากการซื้อขาย manual/matching/force-distribution (`fromWId` = wallet ผู้ขาย) → เป็น**ใบเสร็จ**ฝั่งผู้ซื้อ ไม่ใช่ bill
   - ใบจาก top-up (SYSTEM→wallet, kWH=0) → เป็นหลักฐานเติมเงิน
   - Payment intent (fromWId/toWId ว่าง) → ของ Stripe flow
4. ใบที่ `paid` แล้ว**ไม่ถูกอัปเดตยอดซ้ำ**; ใบ unpaid จะ re-sync ยอดตาม snapshot ล่าสุด
5. Overdue: เกิน dueDate 7 วันขึ้นไป → status late + แจ้งเตือน (7/15 วัน, เดือนใหม่)

### ช่องว่างที่รู้อยู่ (ยังไม่แก้ — รอ decision)

- ตึกที่**ขาย**พลังงาน (producer): consume ของตึกต้นทางถูกหัดลดที่ meter แล้ว แต่ `dailyEnergy` ที่ aggregate ไปก่อนหน้า**ไม่ถูกปรับย้อนหลัง** → consume ในบิลอาจสูงกว่าจริงเล็กน้อยช่วงที่ขาย
- ใบ bill ตอน consume เป็น 0 แต่เคยซื้อขาย → ไม่สร้างใบ (totalKwh > 0 เท่านั้น)

## 8. Receipt / Transaction หลังจ่าย

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 8.1 | จ่าย invoice รายเดือน | Transaction(INVOICE_PAYMENT) + WalletTx(−) + Receipt, status→paid |
| 8.2 | เปิด `/receipts` | เห็นใบเสร็จทั้ง topup/trade/payment พร้อม customer name/email จาก BuildingAssignment |
| 8.3 | เปิด receipt PDF | ดาวน์โหลดได้ |
| 8.4 | หน้า `/transaction` | เห็นรายการ CREDIT/MARKETPLACE_*/INVOICE_PAYMENT ถูก type |
| 8.5 | Blockchain verification | tx ถูก verify (txHash มีค่า) — ถ้า blockchain container รัน |

## 9. Notification

| # | ทดสอบ | คาดหวัง |
|---|---|---|
| 9.1 | Top-up | email เข้า admin inbox + in-app |
| 9.2 | Overdue invoice | แจ้ง owner ของตึก (ผ่าน BuildingAssignment) |
| 9.3 | Offer/Bid created | แจ้ง owner wallet นั้น |
| 9.4 | Settings `/settings` | เปิด/ปิดช่องทาง + ประเภทได้จริง |

---

## พฤติกรรมที่ควรรู้ตอนทดสอบ (ไม่ใช่บั๊ก)

- **Log แรกของ meter ใหม่ไม่ถูกนับใน aggregation** — ระบบนับเฉพาะ delta จาก record ก่อนหน้า (ต้องมี baseline ก่อน)
- **mock-simulator กำลังเขียนค่าจำลองทับ meter** ตลอดเวลาใน dev — ถ้าต้องการค่าตรงเป๊ะให้หยุด container `nida-mock-simulator-dev` ก่อน assert ค่า meter
- ยอด token เป็นรายอาคาร — เติมเข้า Alpha แล้วซื้อโดยเลือกปลายทาง Beta จะเช็คยอดของ Beta (design)
- rate ต้องอยู่ช่วง: Intraday ≥ 3.85, Day-Ahead 3.5–3.99

## ข้อผิดพลาดที่แก้ไปแล้ว (อ้างอิงเวอร์ชันนี้)

| Fix | ที่อยู่ |
|---|---|
| Market page ยอด token ติด 0 (gate ที่ b?.email) | frontend market.js |
| Matching โหมด no-battery ตัดเงินแต่พลังงานไม่เข้า meter | backend market.service.js (fallback consumer meter) |
| **Double deduction**: ขายแล้วโดนหัก meter ต้นทางซ้ำ → meter ติดลบ | createOffer หัดตอนสร้าง offer (reserve) แล้ว — ลบ sale-time deduction ใน `purchaseMarketplaceEnergy` + `sellToBid`, log SOLD ใช้ kW:0 + kWH clamp |
| Invoice list ปนใบซื้อขาย/topup/payment-intent | backend invoice.model.js `getInvoices` filter `fromWId=SYSTEM + dueDate != null` (ส่ง `includeAll:true` เพื่อดูทั้งหมด) |
| ใบ top-up ชน dedup ของ `createMonthlyInvoices` → ใบกำกับจริงไม่ถูกสร้าง | invoice.model.js กรอง `dueDate: { not: null }` ใน dedup query ด้วย |
| **โมเดลใหม่: 1 ตึก = 1 ใบ/เดือน** — การซื้อขาย (purchase / sellToBid / matching / intraday / force-dist) เดิมสร้าง invoice+receipt ต่อ trade | ทุกเส้นทางเปลี่ยนเป็น upsert **ใบกำกับประจำเดือน** ของผู้ซื้อ (`upsertMonthlyBillInTx` ใน invoice.service.js — ไม่แตะใบที่ paid แล้ว) — ใบเสร็จเกิดเฉพาะตอน top-up/จ่ายบิล |
| marketPurchased เดิมนับจากใบ invoice การค้า (ซึ่งเลิกสร้างแล้ว) | invoice.model.js `getMarketplacePurchaseSnapshot` นับใหม่จาก RunningMeter `source=MARKET` (kW = kWh ที่ส่งมอบ, กรอบเวลา Bangkok UTC+7 เดียวกับ DailyEnergy) |
| sellToBid ไม่หัก meter ต้นทางผู้ขาย (comment เดิมเข้าใจว่า reserve ตอน offer — ซึ่งจริงเฉพาะ offer ไม่ใช่ bid) + หา meter ด้วย `contains:'solar'` ซึ่งไม่ match type `produce` | หัก meter ต้นทางตอนขายเข้า bid (clamp ≥0) + ใช้ `matchesSourceType` ตัวเดียวกับ createOffer |
| trade.engine.js ยัง select `email` บน Building (ไม่มีแล้ว) → cron auto-post offer พังทุกตึก | ลบ `email: true` ออกจาก select |
| sellToBid response ส่ง `receipt` ที่ไม่มีอยู่แล้ว | return `monthlyBill` แทน; frontend market.js หลังซื้อสำเร็จไป `/transaction` แทน `/receipts` |
| **โมเดล Reserve-on-create (bid/offer = จองเฉยๆ)** — เดิม offer หัก meter ตอนสร้าง, bid ไม่จองเงิน, execution หัก/คืนปนกัน | ตอนสร้าง: offer **ไม่หัก meter** (ตรวจ available = meter − open offers แล้ว reject ถ้าไม่พอ), bid **ตรวจ free balance = balance − จองอื่น** แล้ว reject ถ้าไม่พอ — ไม่มีอะไรเคลื่อนจริง / ตอน cancel: ปลดจองเท่านั้น (**ไม่ refund** เพราะเงินไม่เคยถูกตัด) / ตอนซื้อ-ขาย (purchase, sellToBid, matching, intraday, force-dist, self-charge): ส่งถ่ายจริง — หัก meter ผู้ขาย + เติม meter ผู้ซื้อ + ตัด/ให้ token ณ จุดนั้นจุดเดียว |
| บั๊กเก่าที่เจอระหว่างทำ: (1) over-offer guard **นับ offer ที่เพิ่งสร้างตัดตัวเอง** → net ติดลบ → "cancel stale offers" ยกเลิก offer ทั้ง wallet, (2) trade.engine select `email` (ไม่มีแล้ว) และ select ไม่มี `id` → cron พัง, (3) `getBidReservedAmount` เป็น async ทำ NaN → guard ตายเงียบ, (4) soldMeterSnid scoping ผิด | (1) exclude `created.id` + เปลี่ยน cap/cancel-stale เป็น **reject ชัดเจน** (tx rollback ไม่ทิ้ง row), (2) ลบ email + เพิ่ม id, (3) เอา async ออก, (4) ย้ายประกาศขึ้น outer scope |
| OTP ทับกันเมื่อ email เดียวกัน | backend user.controller.js (key = email+name) |
| Register ชื่อซ้ำ / แก้ email / legacy email lookup | backend user.service.js + user.controller.js |
| **GapBar (แถบส้มข้อมูลขาด) ตำแหน่งเพี้ยน + ไม่ตรวจขอบช่วง** — ข้อมูลหยุดก่อนจบช่วง/เริ่มช้าไม่ถูกแสดง, โหมด today ตัด boundary ด้วย tz ของ server ไม่ตรงกับกราฟ browser, label ปัด "6h 60m" | backend dashboard.model.js `getGaps`: ตรวจ edge gap หัว/หาง (ขยายไปถึง log ก่อน/หลังช่วง), รับ `tz` จาก frontend (browser ส่ง `Intl...timeZone` อัตโนมัติผ่าน data_connecter) ใช้ตัด boundary วัน, `formatGapLabel` คิดจากนาทีรวมก่อนปัด; GapBar.js: gap จิ๋วแสดงขั้นต่ำ 0.2% + legend รวมชั่วโมง gap ทั้งหมด |
| **Gap ของกราฟภาพรวมใช้ meter เดียว (ตัวแรกของตึกแรก)** — ทั้งที่กราฟเป็นผลรวมทั้งระบบ, ทำให้แถบส้มโชว์ gap ปลอม (meter ตัวแรกเงียบแต่ตัวอื่นมีข้อมูล) | `getGaps` รับ `meterIds` หลายตัว (CSV) — **union timestamps ทุก meter**: gap = "ทุก meter เงียบพร้อมกัน"; Admin Dashboard (dashboardHome) ส่ง producer+consumer ครบทุกตัว, Analytics (report.js) ส่ง snid จากทุกตึก, หน้ากราฟราย building/meter (meter.js) คงอ่านรายเดี่ยวตาม design |
| Analytics หน้าราย building ไม่มี GapBar ของตัวเอง | report.js: เพิ่ม `perBuildingGaps` — มุมมอง All แสดงแถบ gap ระบบเดิม, เมื่อเลือก building แสดง **GapBar แยกต่อตึก** (union เฉพาะ meter ของตึกนั้น) พร้อม label ชื่อตึก |
| **GapBar ไม่ตรงคอลัมน์กราฟ (bucket mismatch)** — หน้า meter: today กราฟโชว์ "วันล่าสุดที่มีข้อมูล" แต่ gap ไปดึงวันนี้, week gap ยาว 8 วัน vs กราฟ 7 คอลัมน์, month 31 vs 30; report.js query gap ด้วยขอบ `toISOString()` ที่ติดเวลาปัจจุบัน (ไม่ใช่เที่ยงคืน) → bucket grid เพี้ยน; ทุกจุดที่คำนวณ bucket ใช้ `bTo+1` ทำให้ shade เกิน bucket ที่มี log กลับมา; dashboard โหมด 1D ใช้ `date:` (backend ตัด end 23:59:59.999) → bucket สุดท้ายไม่ถูก shade | meter.js: gap effect ใช้ anchor + ความยาวช่วง**เดียวกับกราฟทุกโหมด** (today = วันล่าสุดที่มีข้อมูล, week = 7 วัน, month = 30 วัน, custom = วันเริ่ม–จบ), ขอบ end แบบ exclusive (setHours(24,0,0,0)); report.js (system + per-building): query และ render ด้วยขอบเที่ยงคืนถึงเที่ยงคืนพอดีกับคอลัมน์วัน; dashboardHome: สลับเป็น from/to แบบ midnight..midnight, แก้ `+1` เป็นสูตรเดียวกับ GapBar/gapShapes; พิสูจน์ด้วยข้อมูล API จริง — shade เฉพาะคอลัมน์ว่าง (PASS) |
| **GapBar ยังวางไม่ตรงคอลัมน์กราฟ (รอบ 2)** — (ก) แถบส้มใช้ margin **hardcode** (report 60/20, meter 55/15, dashboard 68/0) แต่ Plotly ปรับ margin จริงเอง (`xaxis.automargin`, legend ขวา, แกน SoC ที่ 2) → แถบเลื่อน/ย่อไม่ตรงพื้นที่ plot จริง (ข) legend "Xh total" ของกราฟ**รายวัน** ใช้จำนวน bucket แทนชั่วโมง → gap 7 วันโชว์ "7h" แทน 168h (ค) สูตร bucket ถูกเขียนซ้ำ 2 ชุด (GapBar กับ gapShapes) เคยเพี้ยนไม่ตรงกัน (ง) dashboard คำนวณ bucket ชุดที่ 3 เอง | (ก) เพิ่ม `usePlotArea` — วัดพื้นที่ plot จริงจาก `_fullLayout.xaxis._offset/_length` แล้วส่งเป็น px ให้ GapBar (`plotLeft`/`plotWidth`) โดยยังมี margin เป็น fallback เฟรมแรก; meter.js/report.js ต่อ `onInitialized/onUpdate/onRelayout`, dashboardHome วัด strip คอลัมน์จริงของ bar chart (custom chart ไม่ใช่ Plotly) (ข) ถอนสูตรให้เป็น **ชุดเดียว** ใน `utils/gapShapes.js` — `computeGapSegments` ใช้ร่วมกันทั้ง GapBar / เงาในกราฟ / `computeGapBuckets` ของ dashboard และคูน `hours = (hi-lo)*stepMs/3600000` (ค+ง) dashboard เรียก `computeGapBuckets` แทนโค้ดของตัวเอง |
| **Analytics ไม่มี tooltip บอกว่าเป็นช่วงข้อมูลขาด** — ต่างจาก Dashboard ที่คอลัมน์ที่ว่างมี title “No log data in this hour/day” แต่เงาในกราฟ Plotly เป็น shape ซึ่ง **hover ไม่ได้** (Plotly ไม่รองรับ hover บน shape) | report.js `EnergyChart` เพิ่ม **trace ล่องหน** (marker โปร่งใส + `opacity: 0`, `showlegend: false`) ที่ bucket ที่ว่าง โดยใส่ `hovertemplate: "No log data in this <unit>"` → กล่อง hover แบบ `x unified` ของกราฟเดิมจะขึ้นบรรทัดนี้เพิ่มเมื่อเลือกคอลัมน์ที่ว่าง (โดยไม่กระทบแกน/legend); unit = `hour` สำหรับโหมด 1 Day (bucket รายชั่วโมง) และ `day` สำหรับ Week/Month/Year/Custom (bucket รายวัน) — ใช้ `computeGapBuckets(..., {align:'point'})` ชุดเดียวกับเงา; พิสูจน์บนหน้าเว็บจริง (เจาะช่องว่าง 22–24 Sept): hover layer แสดง `Production: 0 kWh | Consumption: 66 kWh | No log data in this day` |
| **ขอบ Gap ไม่ตรงกับวันที่ (รอบ 5)** — จุดเริ่มของ gap ไม่ตรงกับตำแหน่งของวันที่แรกของ time frame และวันที่ที่ไม่มีข้อมูลถูกคลุมเพียงครึ่งเดียว (เช่น 25 Sept ว่าง แต่สีส้มหยุดที่ขอบช่อง = กลางวันของ 25 Sept) เพราะใช้สูตร `i/N` ซึ่งเป็น **ขอบช่อง** ไม่ใช่ **ตำแหน่งของ label วันที่** | `gapShapes.js`: เพิ่มโมเดล `align` — `band` (default, ช่อง CSS/flex ที่ label อยู่กลางช่อง → ใช้กับ Dashboard) และ `point` (category axis ที่ label กระจายขอบถึงขอบ → ใช้กับ Analytics/meter) โดย `point` คำนวณขอบเขตเป็น `[(i-0.5)/(N-1), (j-0.5)/(N-1)]` = **วันที่แต่ละวันครองครึ่งช่องซ้าย-ขวารอบ label ของมัน** แล้ว clamp กับขอบ plot — ทั้งเงาในกราฟ (paper coords) และแถบล่าง (GapBar รับ prop `align`) ใช้ตัวเลขชุดเดียวกัน · พิสูจน์บนหน้าเว็บจริง (1 Week 20–26 Sep, ว่าง 20–25): label อยู่ที่ 0/16.7/../83.3/100%, เงา+แถบ = `0% → 91.67%` = **เริ่มที่ 20 Sep พอดี** และจบที่ **จุดกึ่งกลางระหว่าง 25 Sep กับ 26 Sep** = คลุมวัน 25 Sep เต็มวัน |
| **GapBar หน้า Analytics แสดงไม่เหมือนหน้า Dashboard (รอบ 3+4)** — เงาในกราฟใช้พิกัด **category axis** `[lo, hi]` ซึ่งผูกกับวิธีที่ Plotly auto-range แกน (line chart 1 จุด/ช่อง → `range=[0,6]` ขอบถึงขอบ ที่ N=7) ทำให้ความยาวที่เห็นไม่คงที่ · แถบด้านล่างใช้ `hi/N` ขณะในกราฟจบที่ขอบ → **แถบล่างยาวกว่าที่ระบายในกราฟ** และไม่เหมือนหน้า Dashboard | `gapShapes.js`: ใช้ **โมเดล bucket เดียวทั้งระบบ** เหมือนหน้า Dashboard — bucket i ครอง `[i, i+1]` ของความกว้างกราฟ (frac = `i/N`) และเงาในกราฟส่งเป็น **พิกัด paper (0..1)** แทน category axis → ไม่ขึ้นกับวิธี auto-range ของ Plotly อีก ไม่มีทางเพี้ยนจากแกน; ตัด prop `grid`/โมเดล `centered` ที่เพิ่มไว้รอบก่อนออกให้เหลือทางเดียว; N=1 ครองเต็มความกว้าง, N=0 อิงเวลา, gap ที่แตะขอบจบที่ 0%/100% พอดี · พิสูจน์บนหน้าเว็บจริง: shape เป็น `xref=paper, x0=0, x1=0.857142` (=6/7) และแถบล่าง `width:85.7143%` ตรงกันเป๊ะ (พิกเซล 267→269 เท่ากัน) |
| **Analytics ไม่มีมุมมองรายชั่วโมง** — น้อยสุดคือ 1 Week, อยากได้ 1 Day (00:00–23:00) | report.js: เพิ่มโหมด `1day` — ปุ่มใหม่หน้าปุ่ม 1 Week, `getDaysForRange('1day') = 24` hourly buckets, ยิง `timeunit: 'hour'` (backend มีอยู่แล้ว) ช่วง start=end=วันนี้, labels `"00:00".."23:00"`, mapping key = `HH:00` จาก datetime (แทน key วันที่), สถิติหน้า (Total/Top Consumers) สรุปเฉพาะวันนี้, gap = เที่ยงคืนถึงเที่ยงคืน (24 buckets), SoC รายตึกปิดในโหมดนี้ (parser แบบรายวันอ่าน label ชั่วโมงไม่ได้), export CSV/PDF แสดง "1 Day"; พิสูจน์: backend hourly series 24 จุดครบ + mapping ลงคอลัมน์ถูกต้อง (PASS), npm test ผ่าน |
| **Analytics: Gap ขึ้นทับวันที่กราฟ "มีข้อมูล" (ผิดตั้งแต่ logic)** — gap เดิมอ่านจาก **log ดิบ** (`RunningMeter`) แต่ค่าที่กราฟวาดเป็น **aggregate** (`DailyEnergy`/`HourlyEnergy`) ซึ่งเก็บวันที่มีค่าไว้ได้แม้ log ดิบถูกลบ (หรือกลับกัน) → สีส้มทับวันที่กราฟลากเส้นอยู่จริง และตอนนั้นเงาใช้พิกัด category axis (`align:'point'`) ทำให้เงาในกราฟกับแถบล่างคนละที่ | **เปลี่ยนเป็น data-driven ทั้งหน้า**: `bucketHasData` ตัดสินจากค่าที่กราฟวาดจริง — bucket เป็น gap ก็ต่อเมื่อ **ทุก series ที่เปิดอยู่** ว่าง (`Produce>0` / `Consume>0` / `SoC` มีค่าและตึกนั้นมีแบต) · All Building = ผลรวมทั้งระบบ `/` เลือกหลายตึก = ว่างพร้อมกัน **ทุกตึก** · ตัวเลขชุดเดียวป้อน 3 ที่ (เงาในกราฟ, hover tooltip, GapBar) ผ่าน `computeEmptyBucketSegments` · ลบ `getGaps` + state `reportGaps`/`perBuildingGaps` ออกทั้งหมด · พิสูจน์บนหน้าเว็บจริง 3 เคส: (ก) ปกติ = `shapes: []` ไม่มี gap แม้ log ดิบไม่ครบ (ข) ปิด Consume เหลือ Produce (ทุกค่า 0) = เงาเต็มช่วง 0→1 + แถบ 100% + "168h total" (ค) จัดการ aggregate ให้เป็น 0 เฉพาะ 22–24 Sept = เงา `0.25→0.75` + แถบ `25% width 50%` ตรงกันเป๊ะ และโหมด 1 Day ก็ตรง (`01:00` → `2.17%/4.35%`, `21:00–23:00` → `89.13%/10.87%` + hover "No log data in this hour") |
| **`admin-quick-register` สร้างตึกใหม่ไม่ได้** — `prisma.building.create()` ไม่ส่ง `id` แต่ `Building.id` เป็น `Int @id` ไม่มี autoincrement → 400 `Argument \`id\` is missing` (ตึกที่มีอยู่แล้วรอด เพราะโค้ดข้ามการ create) | user.controller.js: คำนวณ `MAX(id)+1` แล้วส่ง `id` เหมือน `building.model.createBuilding` — เจอโดยหน้า Testing ใหม่ (E2E run แรก) |
| **`DELETE /buildings/:id?force=true` ลบตึกที่เคยซื้อขายไม่ออก** — force path ลบ assignment/meter/energy/wallet/invoice แล้ว แต่ไม่ได้ลบ `WalletTx`, `Receipt`, `MarketMatch` ที่ชี้มาที่ wallet/order/invoice → P2003 แล้วตอบ 409 ทั้งที่ส่ง force=true | building.model.js (force branch): ลบตามลำดับ FK — marketMatch (ของ order ในตึก) → marketOrder → receipt → invoice → walletTx → transaction (buildingName/buildingId/walletId) → wallet → building; พิสูจน์: E2E cleanup ลบ A/B/C สำเร็จ (HTTP 200) และ DB เหลือ 0 rows ทุกตาราง |

---

## หน้า Admin → Testing (End-to-End API Test)

เพิ่มเมนู **🧪 Testing** ในแถบ Taskbar ฝั่ง Admin (และ map `currentKey` ให้ไฮไลต์ถูก) — หน้า `/admin/testing` มี 2 แท็บ: **End-to-End API** (ใหม่) และ **Trading Suite** (ของเดิม)

| ส่วน | รายละเอียด |
|---|---|
| `core/data_connecter/apiTest.js` | ชั้น HTTP ชั้นเดียวของชุดทดสอบ — `apiRequest/apiGet/apiPost/...` ผ่าน base URL + `x-data-mode` + token เหมือนทั้งแอป (ไม่ให้ axios หลุดเข้าไปใน page), `validateStatus: () => true` เพื่อให้ 4xx/5xx เป็น "ผลการทดสอบ" ไม่ใช่ exception + `setApiTestToken()` ให้ run ใช้ token จากการ admin-login สด ๆ (token เก่าใน localStorage ที่ชี้ไป user ที่ถูกลบ จะทำให้ endpoint ที่ต้อง auth fail ปลอม) |
| `utils/apiTestSuite.js` | นิยาม 76 เคส แบ่ง 9 phase: connectivity & auth → buildings → meters → energy & charts → wallet → market/trading → invoice/receipt → system → cleanup; ทุกเคสประกาศ `method` + `path` เพื่อให้ UI บอกได้ว่า endpoint ไหนพัง; `TestSkip` (precondition ไม่ครบ = ไม่นับ fail), `optional()` สำหรับ cleanup (fail = WARN ไม่ใช่ FAIL); `createRun()` / `runCases()` แชร์ `ctx` ระหว่าง step (buildingId, snid, walletId, orderId, invoiceId) |
| `pages/admin/apiTestPage.js` | Progress bar (done/total + ชื่อ step ปัจจุบัน), ชิปสรุป Passed/Failed/Skipped/Warnings/Elapsed, **กล่องแดง "Endpoint ที่ทำงานไม่ได้"** (method + path + error + HTTP status), checklist เต็มแยกตาม phase พร้อม HTTP code/ms/รายละเอียด, ช่อง admin password, สวิตช์ cleanup |

### สิ่งที่ทดสอบ (ลำดับเดียวกับ flow จริง)

register (quick register user+building+meters+wallet) → buildings CRUD/approve/assign → meters (list/by-building/by-snid/approved/pending/register/approve) → running meter (generate-hourly, insert-logs-bulk, status) → **กราฟ** (`/dashboard/search` timeunit=day+hour, hourly/daily/weekly/monthly, gaps, meter type lists) → wallet (by-building/balance/topup/transactions) → market (`/market/orders` OFFER+BID, purchase, sell-to-bid, trigger-matching, matches) → invoice (generate/summary/quota-warnings/list/get) → **pay invoice** → receipts (list/get) → system (rates, settings, policy, notifications, energy-feed) → cleanup (cancel orders, delete meter/building แบบ force)

### ผลรันจริง (localhost:3000/admin/testing, data mode real)

```
76 PASSED · 0 FAILED · 0 SKIPPED · 0 WARNINGS · 15.0s ELAPSED
```

หลังจบ: DB เหลือ 0 building / 0 wallet / 0 meter / 0 invoice / 0 receipt / 0 running log (เหลือแค่ user ที่ seed ไว้) — พร้อมรันซ้ำได้ทันที

> ⚠️ **ข้อควรระวังของ environment dev**: `docker-compose.dev.yml` สั่ง backend รัน `push-both-dbs.sh --force-reset ...` ทุกครั้งที่ start container → **restart backend = ข้อมูลจริง (energy_trading) ถูกล้างทั้งหมด** (ยืนยันแล้ว: restart แล้วตาราง `Building` เหลือ 0 แถว) — ถ้าไม่ต้องการให้ล้างทุกครั้ง ให้เอา `--force-reset` ออก แล้วใช้ `docker compose down -v` เมื่อตั้งใจจะรีเซ็ตเท่านั้น
> ผลพวงอีกอย่าง: หลังล้าง DB แล้ว session ในเบราว์เซอร์ชี้ไป user ที่ไม่มีอยู่ → `GET /users/:credId` = 404 → sidebar ตกไปเป็นเมนู USER แม้จะเป็น admin (ต้อง login ใหม่)

---

### อ่านง่ายขึ้น: ย่อ font ทั้งหน้า Invoice Payment (`/invoice/:id/pay`)

| จุด | ก่อน | หลัง |
|---|---|---|
| หัวเรื่อง (h1) | text-xl / 2xl | text-lg / xl |
| **Billing Period** (ค่าหลัก) | text-2xl → **ขึ้นบรรทัดใหม่** | text-base + `whitespace-nowrap` → **บรรทัดเดียว** (วัดจริง 278px ในกล่อง 379px, h=30px = line-height พอดี) |
| Label ใน grid รายละเอียด | text-sm | text-xs |
| ค่า grid (Total Energy Used / Billable / Rate / Invoice ID) | text-2xl | text-lg |
| แถว Energy Breakdown | text-xl | text-base |
| Total Amount Due / Total to Pay | 2xl / 3xl | base / lg |
| Payment Summary | text-base | text-sm |
| Digital Wallet / Terms / Payment Method | lg / lg / xl | base / base / lg |
| Confirm + Success view (NIDA, Receipt ID, ยอดรวม) | text-4xl / 3xl / 2xl | text-2xl / lg / lg |

พิสูจน์: ตรวจ computed style จากหน้าเว็บจริง — `Billing Period` = 20px, `nowrap`, สูง 30px = 1 บรรทัด (เดิม 30px ต่อบรรทัดและตัดขึ้นบรรทัดที่ 2); ไม่มี element ที่ล้นกรอบ; esbuild ผ่าน

> หมายเหตุเชิงระบบ: ฟอนต์ทั้งแอปถูกขยาย **25%** เพราะมี 3 ที่ตั้ง baseline ไว้ 20px (ค่าปกติ 16px) — แก้ครบทั้ง 3 แล้ว (ดูหัวข้อถัดไป)

---

### ลดขนาดฟอนต์ทั้งแอป (16px baseline) — แก้ครบ 3 จุด

เดิม 20px ถูกตั้งไว้ **3 ที่พร้อมกัน** จึงลดที่เดียวไม่พอ (`App.less` ทับ `App.css` อีกชั้น — `App.js` import `App.less`, `index.js` import `App.css`):

| ไฟล์ | ค่าเดิม | ค่าใหม่ | ผล |
|---|---|---|---|
| `src/assets/App.css` | `html { font-size: 20px }` | **16px** | ทุก utility ของ Tailwind (rem-based) |
| `src/assets/App.less` | `html { font-size: 20px }` | **16px** | ตัวที่ **ชนะจริง** ใน cascade |
| `vite.config.mjs` (less `modifyVars`) | `'@font-size-base': '20px'` | **16px** | ฟอนต์/ระยะของ antd ทุก component |

ผลที่วัดได้จากหน้าเว็บจริง (root 20px → 16px):

| ค่า | ก่อน | หลัง |
|---|---|---|
| `text-sm` | 17.5px | **14px** |
| `text-xs` | 15px | **12px** |
| antd button | 20px / สูง 40px | **16px / สูง 32px** |
| ความสูงหน้า Dashboard | 6,560px | **4,957px** (−24%) |
| ความสูงหน้า Invoice pay | 3,535px | **2,477px** (−30%) |

ตรวจแล้ว: dashboard / analytics (กราฟวาดปกติ 267×400, 280×280, 204×350) / meter-registration / invoice pay — โหลดได้ ไม่มี console error
ฝั่งซ้ายไม่ล้นจอ (scrollWidth 563 < viewport), `Billing Period` ยังอยู่บรรทัดเดียวที่ 16px (สูง 24px)

> ค่าทั้ง 3 จุดนี้ **ต้องแก้พร้อมกัน** — ถ้าจะปรับความหนาแน่นทั้งแอปอีก ให้แก้พร้อมกันทั้ง `App.css` / `App.less` / `@font-size-base` และอย่าให้ `font-size: 20px` ที่ hardcode ในคลาส legacy (`.home-div`, `.security-div`, `.parking-div` ฯลฯ ใน `App.less`) ทำให้เข้าใจผิด — คลาสเหล่านั้นไม่ได้ถูกใช้ในแอปนี้
> ⚠️ กับดัก CSS: คอมเมนต์ที่พิมพ์ `text-*/spacing` จะปิดคอมเมนต์ก่อนเวลา (จาก `*/`) ทำให้ Vite ตอบ 500 ทั้งไฟล์ CSS — หลีกเลี่ยงการเขียน `*/` ในคอมเมนต์
