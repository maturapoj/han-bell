# หารเบิ้ล (Han Bell)

เว็บแอปหารบิลสไตล์ใบเสร็จ ใส่รายการอาหารและเพื่อนที่ร่วมบิล แล้วดูยอดที่แต่ละคนต้องจ่ายได้ทันที

## ฟีเจอร์

- เพิ่ม/ลบเพื่อนร่วมบิล พร้อมอวาตาร์สีเฉพาะคน
- เพิ่มรายการอาหารทีละอย่าง เลือกได้ว่าใครกินรายการไหนบ้าง (ไม่ต้องหารเท่ากันทุกคน)
- ใส่ส่วนลด, ค่าบริการ (%), VAT (%) และเลือกปัดเศษเป็นบาทเต็มได้
- คำนวณยอดสุทธิของแต่ละคนอัตโนมัติ โดยกระจายส่วนลด/ค่าบริการ/ภาษีตามสัดส่วนที่แต่ละคนสั่งจริง
- ปุ่ม "คัดลอกสรุป" สำหรับแปะลงแชทกลุ่ม
- บันทึกข้อมูลบิลไว้ใน `localStorage` ของเบราว์เซอร์ (เปิดมาครั้งหน้ายังอยู่)

## เริ่มใช้งาน

ติดตั้ง dependencies (ครั้งแรกครั้งเดียว):

```bash
npm install
```

รันเซิร์ฟเวอร์สำหรับพัฒนา:

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) ในเบราว์เซอร์

## Build สำหรับ production

```bash
npm run build
npm run start
```

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Turbopack)
- React state ล้วน ๆ ไม่มี backend/database — ข้อมูลอยู่ในเบราว์เซอร์ของผู้ใช้เท่านั้น
- ฟอนต์ Chakra Petch, IBM Plex Sans Thai, IBM Plex Mono โหลดผ่าน [`next/font/google`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) (self-host ในตัว ไม่ต้องพึ่ง CDN ตอนรัน)

## โครงสร้างไฟล์หลัก

- `src/app/page.tsx` — หน้าเว็บและ logic การคำนวณหารบิลทั้งหมด
- `src/app/page.module.css` — สไตล์เฉพาะของหน้าใบเสร็จ
- `src/app/globals.css` — โทเค็นสี (light/dark) และ reset พื้นฐาน
- `src/app/layout.tsx` — root layout, ฟอนต์, metadata
