# 📋 Bot Điểm Danh Discord

Bot Discord tự động hóa điểm danh cho guild — viết bằng **JavaScript (CommonJS) + discord.js v14**.

> ✅ Không cần build step — chạy thẳng bằng `node index.js`

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
- **Live embed** cập nhật real-time: % tỷ lệ tham gia, countdown Discord native
- **Auto-close** phiên sau thời gian đặt trước
- **Reminder** trước khi kết thúc
- **Reschedule timer** khi bot restart
- **Streak tracking** liên tiếp theo phiên
- **Badge milestones**: 🌱5 ⭐10 🌟20 💪30 🏆50 👑100 lần tham gia

---

## 🚀 Setup Local

```bash
git clone https://github.com/yx9mio/discord-bot-diemdanh
cd discord-bot-diemdanh
npm install
cp .env.example .env   # điền DISCORD_TOKEN
node index.js
```

### Yêu cầu
- Node.js 20+
- Discord Bot token với intents: **Guilds**, **Guild Members**

### Cấu trúc dự án

```
index.js          # Entry point — tất cả command handlers
storage.js        # SessionStore, ConfigStore, HistoryStore, MemberStatsStore
streak.js         # Streak & milestone logic
utils/
├── embeds.js     # 5 embed builders
└── progress.js   # Progress bar utility
data/             # Auto-created, gitignored
├── sessions.json
├── history.json
├── config.json
└── members.json
```

---

## 🐳 Deploy

### Wispbyte / VPS (Khuyến nghị)

Bot chạy thẳng Node.js — không cần build:

```bash
# Upload files lên server
npm install
echo "DISCORD_TOKEN=your_token" > .env
node index.js

# Chạy liên tục với PM2
npm install -g pm2
pm2 start index.js --name diemdanh-bot
pm2 save && pm2 startup
```

### Fly.io (Free tier)

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
flyctl launch
flyctl secrets set DISCORD_TOKEN=your_token_here
flyctl deploy
```

**Free tier**: 3 shared-cpu-1x VMs, 256MB RAM.

---

## ⚠️ Lưu ý về Storage

Bot dùng **JSON files** trong `data/` để lưu trữ. Trên các platform ephemeral:

- **Sessions active** ✅ persist qua restart
- **History & member stats** ⚠️ mất khi container bị xóa/redeploy

**Giải pháp production**: Mount persistent volume (Fly Volumes) hoặc migrate sang PostgreSQL/Supabase.

---

## 🏗️ Tech Stack

- **Runtime**: Node.js 20
- **Language**: JavaScript (CommonJS)
- **Discord**: discord.js v14
- **Storage**: JSON files (fs sync)
- **Deploy**: Node.js trực tiếp / Docker / Fly.io
