# ⚔️ Bot Điểm Danh Bang Chiến (TypeScript Enhanced)

Bot Discord quản lý điểm danh bang chiến với giao diện embed đẹp hơn, lịch sử phiên, thống kê thành viên, export file, reminder tự động, auto-close và giới hạn role **Bang Chúng** mới được điểm danh. Repo hiện đã được viết lại bằng **TypeScript + discord.js v14** [cite:23].

## ✨ Tính Năng

- ✅ Nút bấm điểm danh đẹp hơn, cập nhật real-time.
- 🔒 Chỉ role **Bang Chúng** được bấm nút điểm danh.
- 📊 Embed đẹp hơn: progress bar, thumbnail avatar, tổng quan phiên.
- 🗂️ `/lich_su` xem 10 phiên gần nhất.
- 🏆 `/thong_ke` xem top thành viên tham gia nhiều nhất.
- 📦 `/export_diemdanh` xuất danh sách ra file `.txt`.
- ⏰ Reminder tự động trước khi auto-close.
- 🛑 Tự động đóng phiên sau X phút.
- 📣 Có thể ping role khi mở phiên.
- 💾 Lưu dữ liệu bằng JSON: phiên hiện tại + lịch sử.

## 📁 Cấu Trúc

```bash
src/
├── index.ts
├── storage.ts
├── embeds.ts
├── utils.ts
└── types.ts
```

## 🚀 Cài Đặt

Yêu cầu: **Node.js 20+**

```bash
npm install
cp .env.example .env
# điền DISCORD_TOKEN vào .env
```

## ▶️ Chạy Bot

```bash
npm run dev
```

hoặc production:

```bash
npm run build
npm start
```

## 📖 Slash Commands

- `/batdau_diemdanh [ten_tran] [reminder] [tu_dong_dong] [ping_role]`
- `/ket_thuc_diemdanh`
- `/xem_diemdanh`
- `/them_diemdanh @member trang_thai`
- `/xoa_diemdanh @member`
- `/lich_su`
- `/thong_ke`
- `/export_diemdanh`

## ☁️ Deploy

Bot không phù hợp deploy trên Vercel vì Discord bot cần process chạy liên tục. Dùng Oracle Always Free, Wispbyte hoặc các server bot hosting free sẽ hợp hơn.
