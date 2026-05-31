# 📋 Bot Điểm Danh Discord

Bot Discord tự động hóa điểm danh cho guild — viết bằng **JavaScript (CommonJS) + discord.js v14**.

Compatible với **Wispbyte** free hosting và bất kỳ Node.js host nào.

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
- **Live embed** cập nhật real-time: % tỷ lệ tham gia, danh sách chưa điểm danh, countdown
- **Auto-close** phiên sau thời gian đặt trước
- **Reminder** ping 2 phút trước khi kết thúc
- **Streak tracking** liên tiếp theo phiên
- **Badge milestones**: 🌱5 ⭐10 🌟20 💪30 🏆50 👑100 lần tham gia
- **Badge announcement** tự động sau mỗi phiên

---

## 🚀 Setup Local

```bash
git clone https://github.com/yx9mio/discord-bot-diemdanh
cd discord-bot-diemdanh
npm install
cp .env.example .env   # điền DISCORD_TOKEN và CLIENT_ID
npm start
```

### Yêu cầu
- Node.js 18+
- Discord Bot token với intents: **Guilds**, **Guild Members**
- `CLIENT_ID` — lấy từ Discord Developer Portal → Application ID

### Cấu trúc dự án

```
index.js          # Entry point, tất cả command handlers
db.js             # JSON file storage (sessions, history, config, members)
streak.js         # Streak & badge logic
utils/
├── embeds.js     # Embed builders
└── progress.js   # Progress bar utility
data/             # Auto-created, gitignored
├── sessions.json
├── history.json
├── config.json
└── members.json
```

---

## 🌐 Deploy Wispbyte (Miễn Phí)

1. Đăng nhập [wispbyte.com](https://wispbyte.com)
2. Tạo server mới → chọn **Node.js**
3. Upload toàn bộ file: `index.js`, `db.js`, `streak.js`, `utils/`, `package.json`
4. Trong dashboard → **Environment Variables**: thêm `DISCORD_TOKEN` và `CLIENT_ID`
5. Startup file: `index.js`
6. **Start** server

> **Lưu ý:** Wispbyte free tier có 0.5GB RAM — đủ cho bot Discord.

---

## ⚠️ Lưu ý về Storage

Bot dùng **JSON files** trong `data/` để lưu trữ. Trên Wispbyte:
- Files được giữ nguyên khi restart ✅
- Files **có thể mất** nếu server bị xóa hoàn toàn ⚠️
- Backup định kỳ `data/` bằng tay nếu cần

---

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Language**: JavaScript (CommonJS)
- **Discord**: discord.js v14
- **Storage**: JSON files (fs sync)
- **Deploy**: Wispbyte / bất kỳ Node.js host
