# GeckoBoard

Kanban สำหรับทีมทำเกม: **Ticket + Task** → Dev กด "I'll do this" → Claude (MCP) แก้ให้ → **Ready to Test** (พร้อมวิธีเทส) → Tester ผ่าน → **Complete**

## รันเว็บ (host เดียวให้ทั้งทีมใช้)
    npm install
    GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com npm start   # http://localhost:3000  (env: PORT, DB_FILE)

## เชื่อม Claude (แต่ละ Dev ในเครื่องตัวเอง)
เมนูชื่อมุมขวาบน → **Connect Claude (MCP)** → คัดลอกคำสั่งไปรันใน terminal (ไม่ต้อง clone โปรเจกต์):

    claude mcp add --scope user --transport http geckoboard https://<host>/mcp --header "Authorization: Bearer <token ส่วนตัว>"

เซิร์ฟเวอร์เปิด MCP ผ่าน HTTP ที่ `/mcp` อยู่แล้ว (ทางเลือกเสริม: `mcp/server.js` แบบ stdio)

จากนั้นใน Claude Code (เปิดใน repo เกม) พิมพ์ได้เลย เช่น
- "ทำ card ที่ฉัน mark ไว้ทั้งหมด"  (multiple)
- "ทำ #12 ให้หน่อย"  (single)

Claude จะเรียก `list_my_cards` → `get_card` → แก้โค้ด → `mark_ready_for_test`
(บังคับให้มี summary + ขั้นตอนเทส) ถ้า Tester กด Fail การ์ดกลับไป In Progress พร้อมเหตุผลเป็น comment
ซึ่ง Claude อ่านได้จาก `get_card`

## Role
- **dev**: กด I'll do this / ปล่อยการ์ด / mark ready (ผ่าน Claude)
- **tester**: Pass / Fail / Reopen
- **admin**: ทำได้ทุกอย่าง + จัดการทีมที่เมนู Team & roles
ทุกคนสร้างการ์ดและคอมเมนต์ได้ รายชื่อเริ่มต้นอยู่ใน `data/users.seed.json`
Admin เริ่มต้น: temgoodboi@gmail.com (ตั้งเพิ่มได้ด้วย `ADMIN_EMAIL=`)
Token ส่วนตัวสำหรับ MCP ดูได้ที่เมนูชื่อมุมขวาบน → Connect Claude

## Google Sign-in
1. Google Cloud Console → APIs & Services → Credentials → Create **OAuth client ID** (Web application)
2. ใส่ Authorized JavaScript origins = URL ที่ทีมใช้เปิดเว็บ (เช่น https://board.studio.com หรือ http://localhost:3000)
3. เอา Client ID ใส่ env `GOOGLE_CLIENT_ID` ตอนรันเซิร์ฟเวอร์
เซิร์ฟเวอร์ตรวจ token กับ Google และเช็กว่าอีเมลอยู่ในรายชื่อทีม; ไม่ตั้ง `GOOGLE_CLIENT_ID` = login ไม่ได้
(ทดสอบในเครื่องโดยไม่มี Google: `ALLOW_INSECURE_EMAIL_LOGIN=1` — ห้ามใช้บน production)

## Deploy บน Render (ฟรี) + Neon Postgres (ฟรี)
1. สร้างโปรเจกต์ที่ https://neon.tech → copy **connection string** (postgresql://...)
2. Push repo ขึ้น GitHub → Render: New → Blueprint → เลือก repo (ใช้ `render.yaml`, แผน free)
3. Render จะถามค่า `DATABASE_URL` → วาง connection string จาก Neon
4. เอา URL ที่ Render ให้ (https://devboard-xxxx.onrender.com) ไปเพิ่มใน Google OAuth → Authorized JavaScript origins
ถ้าไม่ตั้ง `DATABASE_URL` จะเก็บข้อมูลเป็นไฟล์ `data/db.json` (เหมาะกับรันในเครื่อง)
หมายเหตุ: Render Free จะหลับเมื่อไม่มีคนใช้ ~15 นาที เปิดครั้งแรกอาจรอ ~30-60 วินาที
