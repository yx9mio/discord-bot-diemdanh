# ⚔️ Bot Điểm Danh Bang Chiến (TypeScript)

> Bot Discord quản lý điểm danh bang chiến với nút bấm trực quan, tự động cập nhật danh sách real-time vào một channel riêng.
> Viết bằng **TypeScript** + **discord.js v14**.

---

## ✨ Tính Năng

- 🎮 **Nút bấm điểm danh** — thành viên chọn *Tham Gia* hoặc *Không Tham Gia* chỉ bằng 1 click
- 📋 **Cập nhật real-time** — danh sách hiển thị ngay sau mỗi lần điểm danh
- 📺 **Channel riêng biệt** — tự động tạo `#diemdanh-bang-chien` để pin kết quả
- 🔄 **Đổi trạng thái** — thành viên có thể đổi Tham Gia ↔ Không Tham Gia bất kỳ lúc nào
- 🛡️ **Phân quyền rõ ràng** — chỉ Admin mới mở/đóng phiên điểm danh
- ✏️ **Quản lý thủ công** — Admin thêm/xóa điểm danh cho từng thành viên nếu cần
- 💾 **Persistent JSON** — dữ liệu lưu vào `data/sessions.json`

---

## 📁 Cấu Trúc Dự Án

```
discord-bot-diemdanh/
├── src/
│   ├── index.ts       ← Code chính
│   ├── storage.ts     ← JSON session storage
│   └── types.ts       ← TypeScript interfaces
├── data/              ← Tự tạo khi chạy (sessions.json)
├── dist/              ← Build output
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🚀 Cài Đặt & Chạy

### Bước 1 — Tạo Bot trên Discord Developer Portal

1. Vào [discord.com/developers/applications](https://discord.com/developers/applications)
2. Nhấn **New Application** → đặt tên → **Create**
3. Vào tab **Bot** → bật:
   - ✅ **Server Members Intent**
4. Nhấn **Reset Token** → copy token

### Bước 2 — Mời Bot vào Server

Vào **OAuth2 → URL Generator**, chọn:

| Scopes | Bot Permissions |
|--------|----------------|
| `bot` | `Send Messages` |
| `applications.commands` | `Embed Links` |
| | `Manage Channels` |
| | `Read Message History` |
| | `View Channels` |

### Bước 3 — Cài Dependencies

> Yêu cầu **Node.js 20+**

```bash
npm install
```

### Bước 4 — Cấu Hình Token

```bash
cp .env.example .env
# Mở .env và điền token thật vào
```

### Bước 5 — Chạy

```bash
# Development (không cần build)
npm run dev

# Production
npm run build
npm start
```

---

## 📖 Danh Sách Lệnh

### 🛡️ Admin — cần quyền *Manage Server*

| Lệnh | Mô tả |
|------|-------|
| `/batdau_diemdanh [ten_tran]` | Mở phiên điểm danh mới |
| `/ket_thuc_diemdanh` | Đóng phiên, hiển thị tổng kết |
| `/them_diemdanh @member trang_thai` | Thêm điểm danh thủ công |
| `/xoa_diemdanh @member` | Xóa điểm danh của một thành viên |

### 👥 Thành Viên

| Hành động | Mô tả |
|-----------|-------|
| Nút **✅ Tham Gia** | Điểm danh tham gia |
| Nút **❌ Không Tham Gia** | Điểm danh không tham gia |
| `/xem_diemdanh` | Xem danh sách (ephemeral) |

---

## ☁️ Deploy 24/7 (Free)

### Fly.io *(khuyến nghị)*

```bash
# Cài flyctl
curl -L https://fly.io/install.sh | sh

# Login & deploy
flyctl auth login
flyctl launch
flyctl secrets set DISCORD_TOKEN=token_của_bạn
flyctl deploy
```

Thêm `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Oracle Cloud Always Free

```bash
sudo apt update && sudo apt install nodejs npm -y
npm install
npm run build

# Chạy liên tục với PM2
npm i -g pm2
pm2 start dist/index.js --name diemdanh-bot
pm2 save && pm2 startup
```

---

## ⚠️ Lưu Ý

- **Dữ liệu lưu JSON** — nếu container restart, session đang mở sẽ mất. Nâng cấp lên SQLite/Supabase để bền vững hơn.
- **Mỗi server chỉ có 1 phiên** cùng lúc.
- **Không commit file `.env`** lên GitHub.

## 🛠️ Yêu Cầu

| Thành phần | Phiên bản |
|------------|-----------|
| Node.js | 20 trở lên |
| discord.js | 14.x |
| TypeScript | 5.x |
