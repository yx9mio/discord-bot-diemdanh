# 📋 Discord Bot Điểm Danh

> Bot Discord tự động hóa điểm danh cho guild — **JavaScript (CommonJS) + @sapphire/framework v5 + discord.js v14 + Supabase**.

---

## ✨ Tính Năng

### 👤 Member
| Tính năng | Mô tả |
|---|---|
| `/diemdanh` | Điểm danh phiên hiện tại (tham_gia / tre / khong_tham_gia / co_phep) |
| `/status` | Xem trạng thái phiên: tiến độ %, danh sách theo nhóm, thống kê phái |
| `/help` | Danh sách lệnh với tab USER / ADMIN + quickstart |
| **StringSelectMenu** | Click dropdown trên embed trực tiếp để điểm danh |
| **Live embed** | Tự động refresh mỗi 60s, hiển thị real-time |
| `/setup → Thống kê → Của tôi** | Thống kê cá nhân: total, streak, huy hiệu |
| `/setup → Thống kê → Lịch sử** | Lịch sử điểm danh cá nhân (phân trang) |

### 🛡️ Admin (cần `Manage Server`)
| Tính năng | Mô tả |
|---|---|
| `/setup` | **Smart Home dashboard** — hub trung tâm mọi thao tác |
| **➡ Mở phiên** | Mở phiên mới với tuỳ chọn tên, mô tả, auto-close, role giới hạn |
| **➡ Đóng phiên** | Đóng phiên + thống kê + CSV + huy hiệu |
| **➡ Cài đặt chung** | Cấu hình: kênh log, role phái, timezone, reminder |
| **➡ Lịch cố định** | Thêm/sửa/xoá lịch tuần hoàn + lịch 1 lần |
| **➡ Thành viên** | Quản lý danh sách + reset streak (1 người / tất cả) |
| **➡ Nhật ký** | Xem lịch sử phiên (phân trang) |
| **➡ Thống kê → Xếp hạng** | Top 10 thành viên |
| **➡ Thống kê → Xem người khác** | Tra cứu stats member qua modal |
| **Embed buttons** | 👁 Xem · 🔄 Làm mới · ✏️ Điểm danh thay · 📄 Xuất CSV · ⛔ Hủy phiên · 🔴 Đóng phiên |

### 🤖 Tự Động
- **Scheduler tuần hoàn** — tự động mở/đóng phiên theo lịch, hỗ trợ pre‑close
- **Auto‑close** — đóng phiên sau N phút + reminder 15′ & 5′
- **Live refresh** — embed cập nhật real‑time mỗi 60s
- **Reminder scheduler** — quét mỗi 60s, gửi nhắc trước giờ mở phiên (2 mốc tuỳ chỉnh)
- **Streak** — cộng khi có mặt (`tham_gia`/`tre`), reset về 0 khi vắng phiên eligible
- **Badge milestones** — 🌱5 ⭐10 🌟20 💪30 🏆50 👑100 lần tham gia
- **CSV đính kèm** — tự động sau mỗi phiên đóng
- **Thống kê phái (faction)** — phân tích tỷ lệ tham gia theo role
- **Server stats** — tổng số phiên, thành viên, lượt điểm danh
- **Distributed lock** — advisory lock PostgreSQL chống duplicate attendance

---

## 🚀 Setup

### 1. Clone & cài đặt
```bash
git clone https://github.com/yx9mio/discord-bot-diemdanh
cd discord-bot-diemdanh
npm install
cp .env.example .env
```

### 2. Điền `.env`
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_service_role_key
```

### 3. Tạo bảng Supabase
Chạy SQL trong **Supabase SQL Editor** — xem thư mục `migrations/` hoặc `supabase/migrations/`.

### 4. Chạy bot
```bash
npm start
# hoặc dev mode với nodemon
npm run dev
```

Slash commands được **@sapphire/framework** tự động đăng ký khi bot start.

---

## 🐳 Deploy

### Docker
```bash
docker build -t discord-bot-diemdanh .
docker run -d --env-file .env discord-bot-diemdanh
```

### Railway
Dùng `railway.toml` có sẵn — health check tại `$PORT/health`.

---

## 📁 Cấu Trúc Dự Án

```
discord-bot-diemdanh/
├── index.js                         # Entry point — SapphireClient
├── db.js                            # Supabase data access layer
├── src/commands/                    # Slash commands (Sapphire)
│   ├── attendance/diemdanh.js       # /diemdanh
│   ├── session/status.js            # /status
│   ├── general/help.js              # /help
│   └── setup/                       # /setup — Smart Home dashboard
│       ├── setupCommand.js
│       ├── _HomeView.js
│       ├── _ConfigView.js
│       ├── _ScheduleView.js
│       ├── _MemberView.js
│       ├── _StatsView.js
│       └── _HistoryView.js
├── interaction-handlers/            # Button / SelectMenu / Modal handlers
│   ├── sessionButton.js             # Session controls
│   ├── attendanceSelect.js          # Attendance StringSelectMenu
│   ├── adminMarkModal.js            # Admin mark modal
│   ├── helpPage.js                  # Help pagination
│   └── setup/                       # Dashboard drill-down handlers
├── listeners/                       # Sapphire event listeners
│   ├── ready.js                     # Restore timers + start scheduler
│   ├── guildCreate.js               # Ensure config on join
│   ├── guildDelete.js               # Cleanup on leave
│   ├── commandError.js              # Global command error
│   ├── interactionHandlerError.js   # Global handler error
│   └── legacyCommandRedirect.js     # Redirect old cached commands
├── utils/
│   ├── embeds.js                    # Embed + component builders
│   ├── session.js                   # ketThucPhien, badge, CSV
│   ├── scheduler.js                 # Weekly schedule open/close
│   ├── timers.js                    # Auto-close + refresh timers
│   ├── attendanceService.js         # Shared attendance logic + lock
│   ├── commands.js                  # Central command registry
│   ├── permissions.js               # Admin checker
│   ├── validate.js                  # Zod schemas
│   ├── helpers.js                   # Shared utilities
│   ├── logger.js                    # Pino structured logger
│   ├── format.js                    # Date/time formatters
│   ├── timeCalc.js                  # Timezone-aware calculations
│   ├── csvHelper.js                 # CSV export
│   ├── discordQueue.js              # Rate-limit queue (p-queue)
│   ├── dbRetry.js                   # DB retry (p-retry)
│   ├── sentry.js                    # Sentry breadcrumb helper
│   ├── progress.js                  # Progress bar
│   ├── theme.js                     # Colors + icons
│   └── adminMarkModal.js            # Modal builder
├── services/
│   └── reminderScheduler.js         # Periodic reminder scan
├── events/
│   └── healthServer.js              # HTTP health endpoint
├── preconditions/
│   └── AdminOnly.js                 # Sapphire precondition
├── migrations/                      # SQL migration files
├── tests/                           # Vitest test suite
├── .env.example
├── Dockerfile
├── railway.toml
├── eslint.config.cjs
└── vitest.config.mjs
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 (Alpine) |
| Language | JavaScript (CommonJS) |
| Discord Framework | **@sapphire/framework** v5.3 |
| Discord API | **discord.js** v14.18 |
| Database | **Supabase** (PostgreSQL) |
| Validation | Zod v3 |
| Logging | Pino |
| Date/Time | Luxon + date-fns-tz |
| Scheduling | Croner |
| Testing | Vitest v3 |
| Linting | ESLint v9 (Flat config) |
| Deploy | Docker / Railway |

---

## 🔐 Bot Permissions

Khi invite bot, đảm bảo bật:
- `Send Messages` · `Embed Links` · `Read Message History`
- `Use Slash Commands` · `Manage Messages` · `Attach Files`

**Gateway Intents:** `GUILDS` + `GUILD_MEMBERS` (Privileged)

---

## ⚙️ Logic Quan Trọng

### Scheduler (Lịch Cố Định)
- Mỗi lịch giữ 2 timer: `{id}_open` và `{id}_close` — timer mới clear timer cũ trước khi set
- Close timer gọi thẳng `_dongPhienVaThongKe` để tránh double-reschedule
- Hỗ trợ **pre-close**: đóng điểm danh sớm X phút trước giờ mở (VD: mở 20:00, đóng DD 19:30)
- Khi bot restart: `_khoiPhucCloseTimer` + `_khoiPhucOpenTimer` khôi phục timer từ DB
- Hỗ trợ **lịch 1 lần** (có trường `date`)

### Streak
- Cộng `+1` khi có mặt (`tham_gia` / `tre`)
- Reset về `0` khi eligible vắng mặt
- `best_streak` không bao giờ giảm

### eligible_member_ids
- `null` = tất cả thành viên
- `[]` = không ai được điểm danh
- Luôn dùng `session.eligible_member_ids ?? []` để tránh crash

### Session Lifecycle
```
Mở (dashboard / scheduler) → Active (điểm danh + refresh) → Đóng / Hủy
```

### Distributed Lock
PostgreSQL `pg_try_advisory_lock` ngăn duplicate attendance khi user spam button.

---

## 📝 Biến Môi Trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token |
| `CLIENT_ID` | ✅ | Application ID |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase key (service_role) |
| `NODE_ENV` | ❌ | `development` / `production` |
| `LOG_LEVEL` | ❌ | `trace` / `debug` / `info` / `warn` / `error` |
| `SENTRY_DSN` | ❌ | Sentry DSN (bỏ trống để tắt) |
| `PORT` | ❌ | HTTP health port (mặc định 3000) |
| `GUILD_ID` | ❌ | Dev mode — chỉ register commands cho 1 guild |
| `BOT_OWNER_ID` | ❌ | Bot owner ID (bypass admin check) |

> ⚠️ **Không commit `.env` lên git.**
