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

## Discord แจ้งเตือน (ไม่บังคับ)
1. ใน Discord: ตั้งค่าช่อง → Integrations → Webhooks → New Webhook → Copy Webhook URL
2. ตั้ง env `DISCORD_WEBHOOK_URL` (บน Render: Environment) แล้ว redeploy
3. (ไม่บังคับ) `DISCORD_LANG=en` ถ้าอยากให้ข้อความเป็นอังกฤษ (ค่าเริ่มต้นคือไทย)
4. ระบบจะส่งข้อความเมื่อ: พร้อมเทส / เทสไม่ผ่าน / เสร็จสิ้น / มีการ @แท็กคนในคอมเมนต์ พร้อมลิงก์เปิดการ์ด
   (ลิงก์ใช้ `PUBLIC_URL` หรือ `RENDER_EXTERNAL_URL` ที่ Render ตั้งให้อยู่แล้ว)

## ไฟล์แนบ + ระบบรีไซเคิลพื้นที่
รูป PNG/JPEG/GIF/WebP (≤ 6-8 MB, รูปใหญ่ถูกย่อในเบราว์เซอร์อัตโนมัติ) และวิดีโอ MP4/WebM (≤ 12 MB) สูงสุด 20 ไฟล์ต่อการ์ด
เก็บใน Postgres (ตาราง `devboard_blobs`) เมื่อมี `DATABASE_URL` มิฉะนั้นเก็บใน `data/uploads/`

พื้นที่ฟรีจำกัด จึงทำเป็น "รีไซเคิลอัตโนมัติ" เพื่อให้ใช้ได้ต่อเนื่อง:
- **รูปตัวอย่าง (thumbnail ~10-20 KB) เก็บถาวร** ต้นฉบับถูกรีไซเคิลเมื่อ (1) การ์ดเสร็จนานเกิน `FILE_KEEP_DAYS` (ค่าเริ่มต้น 14 วัน) หรือ (2) พื้นที่รวมเกิน `FILE_BUDGET_MB` (ค่าเริ่มต้น 300 MB)
- ลำดับตอนพื้นที่เต็ม: วิดีโอของงานที่เสร็จ → รูปของงานที่เสร็จ → วิดีโอของงานที่ยังทำ → รูปของงานที่ยังทำ (เก่าสุดก่อน) จนเหลือ 90% ของงบ
- ไฟล์เนื้อหาเดียวกันเก็บชุดเดียว (ตรวจด้วย sha256) แม้แนบหลายการ์ด
- 📌 ปักหมุดไฟล์ = ไม่รีไซเคิล · อัปโหลดไฟล์ที่ถูกรีไซเคิลซ้ำ = ไฟล์กลับมา
- admin ดูการใช้พื้นที่และกด "ล้างตอนนี้" ได้ที่เมนูชื่อ → พื้นที่เก็บไฟล์
- Claude ดูรูปแนบได้ผ่านเครื่องมือ `get_attachment` (ถ้าต้นฉบับถูกรีไซเคิล จะเห็นรูปตัวอย่าง) วิดีโอดูไม่ได้
หมายเหตุ: Neon แผนฟรีมีที่ ~0.5 GB รวมทุกอย่าง จึงตั้งงบไฟล์ไว้ 300 MB ปรับด้วย `FILE_BUDGET_MB`
