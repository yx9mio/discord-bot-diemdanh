# 🎮 Discord Bot Điểm Danh Bang Chiến

Bot Discord viết bằng **TypeScript + discord.js v14** để quản lý điểm danh cho bang/guild trong game.

## ✨ Tính Năng

- 📋 Mở/kết thúc phiên điểm danh với embed trực quan
- ✅ Thành viên tự điểm danh qua nút button
- ⏱️ Tự động kết thúc phiên sau thời gian đặt trước
- 🔔 Nhắc nhở trước khi phiên kết thúc
- 🛡️ Hệ thống role Admin Bot — không cần quyền Quản lý Server
- 📊 Thống kê, lịch sử, xuất file txt
- 🌙 Channel hiển thị riêng tự động tạo

## 📜 Danh Sách Lệnh

### Lệnh Admin Bot
> Yêu cầu role Admin Bot **hoặc** quyền Quản lý Server

| Lệnh | Mô tả |
|------|-------|
| `/batdau_diemdanh` | Mở phiên điểm danh mới |
| `/ket_thuc_diemdanh` | Kết thúc phiên hiện tại |
| `/them_diemdanh` | Thêm điểm danh thủ công |
| `/xoa_diemdanh` | Xóa điểm danh của 1 thành viên |

### Lệnh Cấu Hình
> Yêu cầu quyền **Quản lý Server**

| Lệnh | Mô tả |
|------|-------|
| `/caidat_role` | Đặt role được phép điểm danh |
| `/caidat_admin_role` | Đặt role được dùng lệnh admin bot |
| `/caidat_xem` | Xem cấu hình hiện tại |

### Lệnh Công Khai

| Lệnh | Mô tả |
|------|-------|
| `/xem_diemdanh` | Xem danh sách phiên hiện tại |
| `/lich_su` | Xem lịch sử 10 phiên gần nhất |
| `/thong_ke` | Top thành viên tham gia nhiều nhất |
| `/xuat_diemdanh` | Xuất danh sách ra file `.txt` |

## 🚀 Cài Đặt

### Yêu Cầu

- Node.js 20+
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))

### Chạy Local

```bash
# Clone repo
git clone https://github.com/yx9mio/discord-bot-diemdanh.git
cd discord-bot-diemdanh

# Cài dependencies
npm install

# Tạo file .env
cp .env.example .env
# Điền DISCORD_TOKEN=your_token_here vào .env

# Build và chạy
npm run build
npm start

# Hoặc dev mode (watch)
npm run dev
```

### Deploy Miễn Phí với Fly.io

```bash
# Cài flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch (Fly tự detect Dockerfile)
flyctl launch

# Set bot token
flyctl secrets set DISCORD_TOKEN=your_token_here

# Deploy
flyctl deploy
```

> ⚠️ Bot dùng JSON file để lưu dữ liệu. Trên Fly.io, dữ liệu sẽ mất khi container restart.  
> Để bền vững hơn: thêm [Fly Volume](https://fly.io/docs/volumes/) hoặc chuyển sang Supabase.

## ⚙️ Cấu Hình Ban Đầu

1. Mời bot vào server với quyền: `Send Messages`, `Manage Messages`, `Manage Channels`, `Read Message History`
2. Dùng `/caidat_role` để đặt role được điểm danh (ví dụ: `@Bang Chúng`)
3. Dùng `/caidat_admin_role` để đặt role được dùng lệnh admin bot (ví dụ: `@Bang Chủ`)
4. Dùng `/batdau_diemdanh` để mở phiên đầu tiên

## 🗂️ Cấu Trúc Project

```
discord-bot-diemdanh/
├── src/
│   ├── index.ts          # Entry point, xử lý tất cả commands & events
│   ├── types.ts          # TypeScript interfaces
│   ├── storage.ts        # JSON file storage (sessions, config, history)
│   └── utils/
│       ├── embeds.ts     # Discord embed builders
│       └── progress.ts   # Progress bar utility
├── data/                 # Dữ liệu runtime (gitignored)
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Discord Library**: discord.js v14
- **Storage**: JSON files (local filesystem)
