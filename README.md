# 🎮 Discord Bot Điểm Danh

Bot điểm danh Bang Chiến cho Discord — viết bằng **JavaScript (Node.js)** + **discord.js v14**.

---

## ✨ Tính Năng

| Lệnh | Mô tả | Quyền |
|---|---|---|
| `/batdau_diemdanh` | Mở phiên điểm danh mới | Admin |
| `/ket_thuc_diemdanh` | Kết thúc phiên + lưu lịch sử | Admin |
| `/huy_diemdanh` | Hủy phiên — KHÔNG lưu | Admin |
| `/them_diemdanh` | Thêm thủ công 1 member | Admin |
| `/sua_diemdanh` | Sửa trạng thái hàng loạt (5 member) | Admin |
| `/xoa_diemdanh` | Xóa điểm danh của 1 member | Admin |
| `/nhac_nho` | Nhắc member chưa điểm danh | Admin |
| `/caidat_role` | Cài role được phép điểm danh | ManageGuild |
| `/caidat_admin_role` | Cài role admin bot | ManageGuild |
| `/caidat_xem` | Xem cấu hình hiện tại | ManageGuild |
| `/xem_diemdanh` | Xem danh sách phiên hiện tại | Tất cả |
| `/lich_su` | Xem lịch sử các phiên | Tất cả |
| `/thong_ke_phien` | Chi tiết một phiên cụ thể | Tất cả |
| `/xem_lich_su_member` | Lịch sử điểm danh cá nhân | Tất cả |
| `/thong_ke` | BXH thành viên tham gia nhiều nhất | Tất cả |
| `/xuat_diemdanh` | Xuất danh sách ra file `.txt` | Tất cả |

---

## 🚀 Deploy Miễn Phí — WispByte

[WispByte](https://wispbyte.com) cung cấp hosting Discord bot **24/7 hoàn toàn miễn phí**, không cần thẻ.

### Bước 1 — Chuẩn bị

1. Đăng ký tài khoản tại [wispbyte.com/client](https://wispbyte.com/client)
2. Tạo server Discord Bot mới trên dashboard
3. Chọn runtime **Node.js 20**

### Bước 2 — Upload Code

Zip toàn bộ repo (trừ `node_modules/` và `.env`) rồi upload lên WispByte File Manager, **hoặc** dùng Git:

```
Repository URL: https://github.com/yx9mio/discord-bot-diemdanh
Branch: main
```

### Bước 3 — Cài Biến Môi Trường

Trong tab **Startup** của WispByte panel, thêm:

```
DISCORD_TOKEN = token_bot_của_bạn
```

### Bước 4 — Startup Command

```
node index.js
```

### Bước 5 — Start!

Bấm **Start** trên panel. Bot sẽ online trong vài giây.

---

## 💻 Chạy Local

```bash
git clone https://github.com/yx9mio/discord-bot-diemdanh
cd discord-bot-diemdanh
npm install

# Tạo file .env
echo "DISCORD_TOKEN=token_của_bạn" > .env

npm start
```

---

## 🐳 Chạy bằng Docker

```bash
docker build -t diemdanh-bot .
docker run -e DISCORD_TOKEN=token_của_bạn diemdanh-bot
```

---

## ⚠️ Lưu Ý Storage

Bot hiện dùng **in-memory storage** — dữ liệu (lịch sử, stats, config) sẽ **mất khi bot restart**.

Đây là thiết kế phù hợp với WispByte free tier (không có persistent disk).

Nếu cần lưu trữ bền vững, hãy nâng cấp `storage.js` để dùng **Supabase** hoặc **MongoDB Atlas** (đều có free tier).

---

## 🔧 Cấu Trúc Project

```
├── index.js          # Main bot — commands & event handlers
├── storage.js        # In-memory stores (Session, Config, History, Stats)
├── streak.js         # Logic tính streak & milestone
├── utils/
│   ├── embeds.js     # Builder các Discord Embed
│   └── progress.js   # Progress bar utility
├── .env.example      # Mẫu biến môi trường
├── Dockerfile        # Docker build (Node 20 Alpine)
└── package.json
```

---

## 🛠 Tech Stack

- **Runtime**: Node.js 20
- **Discord**: discord.js v14
- **Config**: dotenv
- **Storage**: In-memory (RAM)
