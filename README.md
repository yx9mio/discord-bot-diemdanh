# 📋 Discord Bot Điểm Danh

Bot Discord quản lý điểm danh cho server/cộng đồng, xây dựng với Sapphire Framework v5, discord.js v14 và Supabase làm database.

---

## ✨ Tính năng

### Quản lý phiên điểm danh
- Mở/đóng phiên thủ công hoặc tự động theo lịch
- Hỗ trợ 4 trạng thái: **Tham gia · Trễ · Có phép · Vắng**
- Advisory lock chống race condition khi nhiều người điểm danh cùng lúc
- Nhắc nhở trước khi bắt đầu (2 mốc thời gian cấu hình được)

### Lịch tự động
- Tạo lịch lặp lại (recurring) hoặc một lần (one-time)
- Hỗ trợ cron-style theo ngày trong tuần + giờ
- Phục hồi lịch trình sau khi bot restart

### Thống kê & báo cáo
- Leaderboard streak, tỷ lệ điểm danh theo khoảng thời gian
- Thống kê theo phong ban
- Export CSV điểm danh theo phiên (gửi file trực tiếp qua Discord)
- Canvas-rendered attendance card (hình ảnh tóm tắt)

### Hệ thống badge
- Tự động cấp badge khi thành viên đạt ngưỡng tham gia
- Các mốc mặc định: 5 · 10 · 20 · 30 · 50 · 100 buổi

### Quản trị (Admin)
- Bảng điều khiển `/setup` với 8 view: Home · Session · Member · Schedule · Stats · History · Audit · Config
- Sửa trạng thái điểm danh qua modal
- Quản lý thành viên (thêm/xóa/sửa phong_ban, ghi_chu)
- Audit log ghi lại mọi thay đổi quan trọng

---

## 🛠️ Tech Stack

| Thành phần | Package |
|---|---|
| Runtime | Node.js ≥ 20 |
| Discord framework | `@sapphire/framework` v5, `discord.js` v14 |
| Database | Supabase (PostgreSQL) |
| Validation | `zod` + `zod-validation-error` |
| Date/time | `luxon` |
| Canvas render | `@napi-rs/canvas` |
| Logger | `pino` + `pino-pretty` |
| Testing | `vitest` v3 |
| Deploy | Railway (Docker) |

---

## 🚀 Cài đặt & Chạy local

### Yêu cầu
- Node.js ≥ 20
- Supabase CLI (`npm i -g supabase`)
- Discord Bot Token (từ [Discord Developer Portal](https://discord.com/developers/applications))

### 1. Clone & install

```bash
git clone https://github.com/yx9mio/discord-bot-diemdanh.git
cd discord-bot-diemdanh
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Điền đầy đủ các biến trong `.env`:

```env
DISCORD_TOKEN=your_discord_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
NODE_ENV=development
GUILD_ID=your_discord_guild_id
```

### 3. Khởi động Supabase local

```bash
npm run supabase:start   # khởi động local Supabase
npm run db:reset         # áp migration + seed data
```

### 4. Chạy bot

```bash
npm run dev    # development (nodemon)
npm start      # production
```

---

## 🗄️ Database

Schema được quản lý qua Supabase migrations tại `supabase/migrations/`.

### Các bảng chính

| Bảng | Mô tả |
|---|---|
| `guild_configs` | Cấu hình per-guild (roles, channels) |
| `sessions` | Phiên điểm danh |
| `attendances` | Bản ghi điểm danh từng thành viên |
| `members` | Danh sách thành viên đã đăng ký |
| `member_stats` | Thống kê tổng hợp (streak, total, rate) |
| `badges` | Định nghĩa badge và ngưỡng |
| `member_badges` | Badge đã cấp cho thành viên |
| `scheduled_sessions` | Lịch mở phiên tự động |

### Lệnh database

```bash
npm run supabase:push         # push migration lên remote
npm run supabase:pull         # pull schema từ remote
npm run supabase:remote-types # generate TypeScript types từ remote
```

---

## 📦 Cấu trúc dự án

```
discord-bot-diemdanh/
├── index.js                  # Entry point, khởi tạo client
├── services/                 # Business logic
│   ├── attendanceService.js  # CRUD điểm danh + advisory lock
│   ├── sessionService.js     # Quản lý phiên
│   ├── memberService.js      # Quản lý thành viên + stats
│   ├── scheduledService.js   # CRUD lịch tự động
│   ├── reminderScheduler.js  # Scheduler nhắc nhở + auto-open
│   ├── badgeService.js       # Cấp badge tự động theo threshold
│   ├── configService.js      # Cấu hình guild
│   └── guildEmojiService.js  # Custom emoji per guild
├── src/
│   ├── commands/
│   │   ├── general/help.js   # Lệnh /help
│   │   └── setup/            # Lệnh /setup (subcommand)
│   │       └── _views/       # 8 view của bảng điều khiển
│   ├── interaction-handlers/ # Xử lý button, select, modal
│   ├── listeners/            # Event listeners
│   └── preconditions/        # Permission guards
├── utils/                    # Shared utilities
│   ├── canvas.js             # Render hình ảnh canvas
│   ├── csvHelper.js          # Export CSV điểm danh
│   ├── auditLog.js           # Ghi audit log
│   ├── error-boundary.js     # Xử lý lỗi global
│   ├── validate.js           # Zod schemas
│   └── ...
├── supabase/
│   ├── migrations/           # SQL migrations (versioned)
│   └── seed.sql              # Dữ liệu khởi tạo
├── tests/                    # Vitest unit tests
├── Dockerfile
└── railway.toml
```

---

## 🤖 Lệnh Discord

### Lệnh chính

| Lệnh | Quyền | Mô tả |
|---|---|---|
| `/help` | Tất cả | Hiển thị hướng dẫn sử dụng |
| `/setup` | Admin | Mở bảng điều khiển quản trị |

### Bảng điều khiển `/setup`

| View | Chức năng |
|---|---|
| 🏠 Home | Tổng quan, trạng thái bot |
| 📅 Session | Mở/đóng phiên, xem danh sách điểm danh, export CSV |
| 👥 Member | Thêm/xóa/sửa thành viên |
| 🗓️ Schedule | CRUD lịch tự động (recurring + one-time) |
| 📊 Stats | Leaderboard, streak, thống kê theo phong ban |
| 📜 History | Lịch sử phiên cũ (có phân trang) |
| 🔍 Audit | Log thao tác admin |
| ⚙️ Config | Cấu hình role & channel |

---

## 🧪 Chạy tests

```bash
npm test            # chạy một lần (CI)
npm run test:watch  # chế độ watch
```

Tests nằm ở `tests/` — bao gồm unit tests cho `csvHelper`, `design-tokens`, và `_helpers`.

---

## 🚢 Deploy lên Railway

1. Push code lên GitHub
2. Tạo project mới trên [Railway](https://railway.app), connect repo
3. Thêm biến môi trường: `DISCORD_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `NODE_ENV=production`, `GUILD_ID`
4. Railway tự build qua `Dockerfile` và deploy

Cấu hình Railway nằm ở `railway.toml`.

---

## 📝 Environment Variables

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token từ Discord Developer Portal |
| `SUPABASE_URL` | ✅ | Project URL từ Supabase dashboard |
| `SUPABASE_KEY` | ✅ | `service_role` key (không phải `anon`) |
| `NODE_ENV` | ✅ | `development` hoặc `production` |
| `GUILD_ID` | ✅ | Discord Guild ID để register slash commands |

---

## 📄 License

Private repository — all rights reserved.
