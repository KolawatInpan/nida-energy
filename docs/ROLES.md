# Roles & Permissions

สรุปบทบาท (roles) และสิ่งที่แต่ละบทบาทสามารถทำได้ — กระชับเพื่ออ้างอิงสำหรับนักพัฒนา

Roles
- USER — ผู้ใช้ทั่วไป (เจ้าของอาคาร/ผู้ใช้ที่ลงทะเบียน)
- ADMIN — ผู้ดูแลระบบ (สิทธิ์เต็ม)

Key actions (action keys ใช้ใน `requirePermission` middleware)

- profile:read — ดูข้อมูลโปรไฟล์ของตัวเอง
- profile:update — แก้ไขข้อมูลโปรไฟล์ของตัวเอง

- meters:read — ดูรายการมิเตอร์ของผู้ใช้
- meters:register — ลงทะเบียนมิเตอร์ใหม่ (ส่งคำขอ)
- meters:update_own — แก้ไขค่าหรือสถานะมิเตอร์ของตนเอง

- offers:create — สร้างคำเสนอขายไฟ (ผู้ขาย)
- offers:read — ดูรายการคำเสนอขาย
- offers:purchase — ซื้อพลังงานจากคำเสนอ

- invoices:read — ดูบิล/ใบแจ้งหนี้ของตน
- receipts:read — ดูใบเสร็จ

- wallet:read — ดูยอดกระเป๋าเงิน
- wallet:topup — เติมเงินกระเป๋า (top-up)

- admin:users:manage — (ADMIN) สร้าง/แก้ไข/ลบผู้ใช้
- admin:system:config — (ADMIN) เปลี่ยนการตั้งค่าระบบ, ดู logs

Mapping summary
- `USER` จะได้รับชุดสิทธิ์มาตรฐาน (profile, meters, trading, billing, wallet)
- `ADMIN` ได้รับ wildcard (`*`) — เข้าถึงทุก action

ไฟล์อ้างอิงในโปรเจค
- สิทธิ์/ฟังก์ชัน: [backend/utils/roles.js](backend/utils/roles.js)
- มิดเดิลแวร์เช็คสิทธิ์: [backend/middleware/requirePermission.js](backend/middleware/requirePermission.js)

ตัวอย่างใช้งานใน route
