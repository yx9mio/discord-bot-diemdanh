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
| **Menu chọn (dropdown)** | Click chọn trạng thái trên embed trực tiếp |
| **Embed tự làm mới** | Cập nhật real-time mỗi 60s |
| **`/setup → Thống kê → Của tôi`** | Số phiên, streak và huy hiệu của bạn |
| **`/setup → Thống kê → Lịch sử`** | Xem lại các phiên đã điểm danh (phân trang) |

### 🛡️ Admin (cần `Manage Server`)
| Tính năng | Mô tả |
|---|---|
| `/setup` | Mở bảng điều khiển — quản lý lịch, thành viên, phiên, cài đặt |
| **➡ Mở phiên** | Tên, mô tả, hẹn giờ đóng (phút), role giới hạn (ID) |
| **➡ Quản lý phiên** | Xem/đóng/xuất CSV nhiều phiên cùng lúc, chi tiết inline |
| **➡ Đóng phiên** | Embed nút `🔒 Đóng phiên` + thống kê + CSV + huy hiệu |
| **➡ Cài đặt** | Kênh thông báo, Timezone, Role Quản lý, Role Điểm danh |
| **➡ Lịch cố định** | `+ Hằng tuần` / `+ Một lần` — thêm/sửa/xoá |
| **➡ Thành viên** | `Thêm thành viên` + sửa/xoá/reset streak từng người |
| **➡ Nhật ký** | Xem lịch sử phiên (phân trang) |
| **➡ Thống kê → Của tôi** | Số phiên, streak và huy hiệu |
| **➡ Thống kê → Xếp hạng** | Top 10 thành viên tích cực nhất |
| **➡ Thống kê → Lịch sử** | Xem lại các phiên đã điểm danh (phân trang) |
| **➡ Thống kê → Xem người khác** | Tra cứu thống kê bất kỳ thành viên |
| **➡ Thống kê → Server** | Tổng quan toàn server |
| **Nút trên embed** | `👁️ Xem danh sách` · `🔄 Làm mới` · `✏️ Điểm danh thay` · `📄 Xuất CSV` · `🗑️ Huỷ phiên` · `🔒 Đóng phiên` |

### 🤖 Tự Động
- **Nhắc lịch** — quét mỗi 60s, gửi nhắc trước giờ mở phiên (2 mốc tuỳ chỉnh) + DM cho eligible members
- **Đa phiên (multi-session)** — nhiều phiên đồng thời, mỗi phiên có timer + auto-refresh riêng
- **Tự đóng (auto-close)** — đóng phiên sau N phút + reminder 15′ & 5′
- **Tự làm mới (live refresh)** — embed cập nhật real‑time mỗi 60s
- **Đóng hàng loạt (batch close)** — đóng tất cả phiên đang mở chỉ 1 click
- **Chi tiết phiên inline** — xem thông tin chi tiết phiên (expand/collapse) ngay trong danh sách
- **Streak** — cộng khi có mặt (`tham_gia`/`tre`), reset về 0 khi vắng phiên eligible
- **Huy hiệu mốc (badge milestones)** — 🌱 Lính Mới (5) · ⭐ Cần Cù (10) · 🌟 Chuyên Cần (20) · 💪 Kiên Trì (30) · 🏆 Huyền Thoại (50) · 👑 Vua Điểm Danh (100)
- **CSV đính kèm** — tự động sau mỗi phiên đóng
- **Thống kê phái** — phân tích tỷ lệ tham gia theo role
- **Thống kê server** — tổng số phiên, thành viên, lượt điểm danh
- **Phục hồi sau khởi động lại** — khôi phục timer + auto-refresh cho tất cả phiên đang mở
- **Hướng dẫn khởi tạo** — banner dashboard hướng dẫn cấu hình bước đầu
- **Khóa phân tán (distributed lock)** — advisory lock PostgreSQL chống duplicate attendance

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
Chạy migration trong thư mục `supabase/migrations/` theo thứ tự, hoặc dùng Supabase CLI:
```bash
npx supabase migration up
```

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
├── src/commands/                    # Slash commands (Sapphire)
│   ├── attendance/diemdanh.js       # /diemdanh
│   ├── session/status.js            # /status
│   ├── general/help.js              # /help
│   └── setup/                       # /setup — Smart Home dashboard
│       ├── setupCommand.js
│       ├── _HomeView.js             # Dashboard chính + onboarding
│       ├── _ConfigView.js           # Cấu hình guild
│       ├── _SessionView.js          # Multi-session list
│       ├── _ScheduleView.js         # Lịch cố định
│       ├── _MemberView.js           # Danh sách thành viên
│       ├── _StatsView.js            # Thống kê + xếp hạng
│       └── _HistoryView.js          # Lịch sử phiên
├── src/interaction-handlers/        # Button / SelectMenu / Modal handlers
│   ├── sessionButton.js             # Session controls (diemdanh, close, refresh...)
│   ├── attendanceSelect.js          # Attendance StringSelectMenu
│   ├── adminMarkModal.js            # Admin mark modal submit
│   ├── helpPage.js                  # Help pagination
│   └── setup/                       # 25+ handlers cho dashboard drill-down
│       ├── setupHome.js
│       ├── setupConfig.js
│       ├── setupConfigEdit.js
│       ├── setupConfigEditModal.js
│       ├── setupConfigEditSelect.js
│       ├── setupSession.js
│       ├── setupSessionStart.js
│       ├── setupSessionStartModal.js
│       ├── setupSessionClose.js
│       ├── setupSchedule.js
│       ├── setupScheduleAddDetailModal.js
│       ├── setupScheduleAddTypeModal.js
│       ├── setupScheduleEditOneTimeModal.js
│       ├── setupScheduleEditOneTimeModalSubmit.js
│       ├── setupMember.js
│       ├── setupMemberAdd.js
│       ├── setupMemberAddModal.js
│       ├── setupMemEditModal.js
│       ├── setupResetStreak.js
│       ├── setupStats.js
│       ├── setupStatsModal.js
│       ├── setupStatsLichsu.js
│       ├── setupHistory.js
│       ├── setupBroadcast.js
│       └── setupBroadcastModal.js
├── src/listeners/                   # Sapphire event listeners
│   ├── ready.js                     # Restore timers + start scheduler
│   ├── guildCreate.js               # Ensure config on join
│   ├── guildDelete.js               # Cleanup timers on leave
│   ├── commandError.js              # Global command error
│   ├── interactionHandlerError.js   # Global handler error
│   └── legacyCommandRedirect.js     # Redirect old cached commands
├── services/                        # Database access layer (Supabase)
│   ├── _client.js                   # Shared client + validators
│   ├── sessionService.js            # CRUD sessions
│   ├── attendanceService.js         # CRUD attendances + bulk insert absent
│   ├── memberService.js             # CRUD members + stats + badges
│   ├── configService.js             # Guild config
│   ├── scheduledService.js          # Scheduled sessions + Vietnamese aliases
│   └── reminderScheduler.js         # Periodic reminder scan + DM
├── utils/
│   ├── embeds.js                    # Embed + component builders
│   ├── session.js                   # endSession, badge, CSV, disableUI
│   ├── timers.js                    # Auto-close + refresh timers (per-session)
│   ├── permissions.js               # requireAdmin checker
│   ├── validate.js                  # Zod schemas
│   ├── helpers.js                   # Shared utilities + replyErrEdit
│   ├── logger.js                    # Pino structured logger
│   ├── format.js                    # Date/time formatters
│   ├── timeCalc.js                  # Timezone-aware calculations
│   ├── csvHelper.js                 # CSV export
│   ├── discordQueue.js              # Rate-limit queue (p-queue)
│   ├── dbRetry.js                   # DB retry (p-retry)
│   ├── sentry.js                    # Sentry breadcrumb helper
│   ├── progress.js                  # Progress bar
│   ├── theme.js                     # Colors + icons
│   ├── metrics.js                   # Prometheus metrics
│   ├── adminMarkModal.js            # Modal builder
│   └── commands.js                  # Central command registry
├── events/
│   └── healthServer.js              # HTTP health endpoint
├── preconditions/
│   └── AdminOnly.js                 # Sapphire precondition
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
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
| Scheduling | Croner (reminder scheduler interval) |
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

### Định tuyến (Interaction Handler Routing)
Mỗi button / select / modal dùng `customId` prefix — mỗi Sapphire handler parse exact match hoặc `startsWith()`.
- Không overlap: mỗi customId thuộc về đúng 1 handler
- `sessionButton.js` nhận: `attend_*`, `session:*`, `admin:mark`
- `setup/*.js` nhận: `setup:*` với prefix cụ thể
- Modal phải dùng `deferReply({ flags: Ephemeral })` — Discord.js v14 không hỗ trợ `deferUpdate()` cho modal

### Đa phiên (Multi-Session)
- `getActiveSessions(guildId)` trả về tất cả phiên đang mở (is_active=true, cancelled=false)
- `_SessionView.js` hiển thị danh sách phân trang (5/page) + nút đóng/xuất/xem chi tiết từng phiên
- `timers.js` dùng `Map<sessionId, timer>` — mỗi phiên có timer + auto-refresh riêng
- `ready.js` khôi phục tất cả timer cho mọi phiên đang mở
- Đóng hàng loạt: `session:confirm_close:all` / `session:cancel_close:all`

### Luồng chỉnh sửa cấu hình (Config Edit)
- Select menus render **inline** trên ConfigView message (không ephemeral) → `editReply()` cập nhật đúng message
- ConfigView messageId lưu trong Map `_configMsgIds` để modal handler lấy và cập nhật sau khi lưu
- Prefix: `setup:cfg:select:*` cho select, `setup:cfg:modal:*` cho modal

### Lịch cố định (Scheduler)
- `reminderScheduler.js` quét mỗi 60s, tìm phiên lịch sắp diễn ra, gửi nhắc + DM
- Hỗ trợ **pre-close**: `pre_close_minutes` phút trước giờ mở để tự động đóng
- `reminder_enabled === false` → bỏ qua lịch đó
- Lịch 1 lần có `scheduled_date`, lịch tuần hoàn có `day_of_week`

### Chuỗi điểm danh (Streak)
- Cộng `+1` khi có mặt (`tham_gia` / `tre`)
- Reset về `0` khi eligible vắng mặt
- `best_streak` không bao giờ giảm

### eligible_member_ids
- `[]` = admin chưa set → không reset streak ai
- `[id1, id2]` = chỉ reset streak cho người trong list mà vắng
- Luôn dùng `session.eligible_member_ids ?? []` để tránh crash

### Vòng đời phiên (Session Lifecycle)
```
Mở (dashboard / lịch cố định / auto)
  → Đang mở (điểm danh + tự làm mới mỗi 60s)
    → Đóng (thủ công / hẹn giờ / đóng hàng loạt)
    → Hủy (giữ điểm danh đã ghi)
```

### Khóa phân tán (Distributed Lock)
PostgreSQL `pg_try_advisory_lock` ngăn trùng điểm danh khi user spam button.

### Bí danh tiếng Việt (Vietnamese Aliases)
Các hàm được export với cả tên tiếng Việt để tương thích ngược:
- `endSession` / `ketThucPhien`
- `cancelTimers` / `huyHenGio`
- `getActiveSessions` / `getLichCoDinh`
- v.v.

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
