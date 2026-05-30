# 📋 Bot Điểm Danh Discord

Bot Discord tự động hóa điểm danh cho guild — viết bằng **TypeScript + discord.js v14**.

---

## ✨ Tính Năng

### 🎮 Member
| Command | Mô tả |
|---|---|
| `/xem_diemdanh` | Xem danh sách điểm danh phiên hiện tại |
| `/lich_su` | Xem lịch sử các phiên đã kết thúc |
| `/thong_ke` | Top 10 thành viên tham gia nhiều nhất |
| `/xuat_diemdanh` | Xuất danh sách ra file `.txt` |
| `/xem_lich_su_member` | Lịch sử cá nhân: tỷ lệ %, streak, huy hiệu |
| `/thong_ke_phien` | Chi tiết 1 phiên cụ thể từ lịch sử |

### 🛡️ Admin
| Command | Mô tả |
|---|---|
| `/batdau_diemdanh` | Mở phiên mới (có auto-close & reminder) |
| `/ket_thuc_diemdanh` | Kết thúc phiên, lưu lịch sử |
| `/huy_diemdanh` | Hủy phiên **không lưu** lịch sử |
| `/them_diemdanh` | Thêm 1 thành viên thủ công |
| `/sua_diemdanh` | Sửa status hàng loạt (tối đa 5 người) |
| `/xoa_diemdanh` | Xóa điểm danh của 1 thành viên |
| `/nhac_nho` | Ping/liệt kê người chưa điểm danh |
| `/caidat_role` | Cài role được phép điểm danh |
| `/caidat_admin_role` | Cài role admin bot |
| `/caidat_xem` | Xem cấu hình hiện tại |

### 🤖 Tự Động
- **Live embed** cập nhật real-time: % tỷ lệ tham gia, danh sách chưa điểm danh, countdown Discord native
- **Auto-close** phiên sau thời gian đặt trước
- **Reminder** trước khi kết thúc
- **Reschedule timer** khi bot restart (sessions.json)
- **Streak tracking** liên tiếp theo phiên (không phá streak khi vắng do không eligible)
- **Badge milestones**: 🌱5 ⭐10 🌟20 💪30 🏆50 👑100 lần tham gia
- **Badge announcement** tự động sau mỗi phiên

---

## 🚀 Setup Local

```bash
git clone https://github.com/yx9mio/discord-bot-diemdanh
cd discord-bot-diemdanh
npm install
cp .env.example .env   # điền DISCORD_TOKEN
npm run dev
```

### Yêu cầu
- Node.js 20+
- Discord Bot token với intents: **Guilds**, **Guild Members**

### Cấu trúc dự án

```
src/
├── index.ts          # Entry point, tất cả command handlers
├── storage.ts        # SessionStore, ConfigStore, HistoryStore, MemberStatsStore
├── streak.ts         # Streak & milestone logic
├── types.ts          # TypeScript interfaces
└── utils/
    ├── embeds.ts     # buildDisplayEmbed, buildSummaryEmbed, ...
    └── progress.ts   # Progress bar utility
data/                 # Auto-created, gitignored
├── sessions.json     # Active sessions (persistent across restart)
├── history.json      # Lịch sử các phiên đã kết thúc
├── config.json       # Guild configs
└── members.json      # Member stats & streak
```

---

## 🐳 Deploy Miễn Phí

### Fly.io (Khuyến nghị)

Bot có sẵn `Dockerfile` — deploy trực tiếp:

```bash
# Cài flyctl
curl -L https://fly.io/install.sh | sh

# Login & deploy
flyctl auth login
flyctl launch          # tự detect Dockerfile
flyctl secrets set DISCORD_TOKEN=your_token_here
flyctl deploy
```

**Free tier**: 3 shared-cpu-1x VMs, 256MB RAM — đủ cho bot Discord.

### Oracle Cloud Always Free (Dài hạn)

VM ARM 24GB RAM, không giới hạn thời gian — tốt nhất cho production:

```bash
# Trên VM Ubuntu 24.04
sudo apt update && sudo apt install -y nodejs npm git
git clone https://github.com/yx9mio/discord-bot-diemdanh
cd discord-bot-diemdanh && npm install && npm run build

# Chạy bằng PM2
npm install -g pm2
pm2 start dist/index.js --name diemdanh-bot
pm2 save && pm2 startup
```

---

## ⚠️ Lưu ý về Storage

Bot dùng **JSON files** trong `data/` để lưu trữ. Trên các platform ephemeral (Fly.io, Railway...):

- **Sessions active** ✅ persist qua restart (sessions.json được đọc khi bot start)
- **History & member stats** ⚠️ **mất khi container bị xóa/redeploy**

**Giải pháp production**: Mount persistent volume (Fly Volumes) hoặc migrate sang PostgreSQL/Supabase.

```bash
# Fly.io persistent volume
flyctl volumes create diemdanh_data --size 1
# Thêm vào fly.toml:
# [mounts]
#   source = "diemdanh_data"
#   destination = "/app/data"
```

---

## 🏗️ Tech Stack

- **Runtime**: Node.js 20 (Alpine)
- **Language**: TypeScript 5
- **Discord**: discord.js v14
- **Storage**: JSON files (fs sync)
- **Deploy**: Docker / Fly.io / Oracle Cloud
