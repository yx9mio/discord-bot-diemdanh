# 📋 Discord Bot Điểm Danh

> Bot Discord tự động hóa điểm danh cho guild — **JavaScript (CommonJS) + discord.js v14 + Supabase**.

---

## ✨ Tính Năng

### 🎮 Member
| Command | Mô tả |
|---|---|
| `/xem_diemdanh` | Xem danh sách điểm danh phiên hiện tại |
| `/lich_su` | Xem 10 phiên gần nhất |
| `/thong_ke` | Top 10 thành viên tham gia nhiều nhất |
| `/xuat_diemdanh` | Xuất danh sách ra file `.txt` |
| `/xem_lich_su_member` | Lịch sử cá nhân: tỷ lệ %, streak, huy hiệu |
| `/thong_ke_phien` | Chi tiết 1 phiên cụ thể từ lịch sử |

### 🛡️ Admin
| Command | Mô tả |
|---|---|
| `/batdau_diemdanh` | Mở phiên mới (có auto-close & reminder) |
| `/ket_thuc_diemdanh` | Kết thúc phiên, lưu lịch sử |
| `/huy_diemdanh` | Hủy phiên (soft-delete, không hiện trong lịch sử) |
| `/them_diemdanh` | Thêm 1 thành viên thủ công |
| `/sua_diemdanh` | Sửa status hàng loạt (tối đa 5 người) |
| `/xoa_diemdanh` | Xóa điểm danh của 1 thành viên |
| `/nhac_nho` | Ping/liệt kê người chưa điểm danh |
| `/caidat_role` | Cài role được phép điểm danh |
| `/caidat_admin_role` | Cài role admin bot |
| `/caidat_xem` | Xem cấu hình hiện tại |

### 📅 Lịch Cố Định
| Command | Mô tả |
|---|---|
| `/lich_them` | Thêm lịch tự động mở/đóng phiên hàng tuần |
| `/lich_xem` | Xem tất cả lịch đã cài |
| `/lich_xoa` | Xóa lịch theo ID |
| `/lich_phai` | Cài role phái cho lịch (thống kê theo phái sau mỗi phiên) |

### 🤖 Tự Động
- **Live embed** cập nhật real-time: % tỷ lệ tham gia, danh sách chưa điểm danh, countdown
- **Auto-close** phiên sau thời gian đặt trước + **Reminder** ping 2 phút trước khi kết thúc
- **Lịch hàng tuần** tự mở + tự đóng phiên, kèm thống kê theo phái
- **Streak tracking** cộng khi có mặt, reset khi vắng phiên eligible
- **Badge milestones**: 🌱 5 ⭐ 10 🌟 20 💪 30 🏆 50 👑 100 lần tham gia
- **Badge announcement** tự động sau mỗi phiên
- **CSV đính kèm** tự động sau mỗi phiên tự đóng
- **Ping role** khi scheduler mở phiên tự động

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

> Lấy `SUPABASE_URL` và `SUPABASE_KEY` tại **Supabase Dashboard → Project Settings → API**.

### 3. Tạo bảng Supabase

Chạy SQL bên dưới trong **Supabase SQL Editor**:

```sql
-- Bảng cấu hình guild
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id        TEXT PRIMARY KEY,
  allowed_role_id TEXT,
  admin_role_id   TEXT,
  phai_role_ids   TEXT[] DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Bảng phiên điểm danh
CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT NOT NULL,
  session_name        TEXT NOT NULL,
  role_name           TEXT DEFAULT 'Tất cả',
  allowed_role_id     TEXT,
  eligible_member_ids TEXT[] DEFAULT NULL,  -- NULL = tất cả thành viên
  started_by          TEXT,
  auto_close_at       TIMESTAMPTZ,
  channel_id          TEXT,
  message_id          TEXT,
  is_active           BOOLEAN DEFAULT true,
  cancelled           BOOLEAN DEFAULT false,
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Bảng điểm danh
CREATE TABLE IF NOT EXISTS attendances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  display_name  TEXT,
  status        TEXT NOT NULL,  -- tham_gia | tre | khong_tham_gia | co_phep
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Bảng thống kê thành viên
CREATE TABLE IF NOT EXISTS member_stats (
  guild_id        TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  total_sessions  INT DEFAULT 0,
  total_joined    INT DEFAULT 0,
  current_streak  INT DEFAULT 0,
  max_streak      INT DEFAULT 0,
  last_session_id UUID,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);

-- Bảng huy hiệu thành viên
CREATE TABLE IF NOT EXISTS member_badges (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  threshold  INT NOT NULL,
  earned_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (guild_id, user_id, threshold)
);

-- Bảng huy hiệu guild (tuỳ chỉnh)
CREATE TABLE IF NOT EXISTS badges (
  guild_id   TEXT NOT NULL,
  threshold  INT NOT NULL,
  emoji      TEXT NOT NULL,
  label      TEXT NOT NULL,
  PRIMARY KEY (guild_id, threshold)
);

-- Bảng lịch cố định
CREATE TABLE IF NOT EXISTS scheduled_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id          TEXT NOT NULL,
  session_name      TEXT NOT NULL,
  day_of_week       INT NOT NULL,   -- 0=CN, 1=T2 … 6=T7
  hour              INT NOT NULL,
  minute            INT NOT NULL DEFAULT 0,
  close_day_of_week INT,
  close_hour        INT,
  close_minute      INT DEFAULT 0,
  allowed_role_id   TEXT,
  channel_id        TEXT NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Index tăng tốc query
CREATE INDEX IF NOT EXISTS idx_sessions_guild_active ON sessions(guild_id, is_active);
CREATE INDEX IF NOT EXISTS idx_attendances_session   ON attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_guild    ON member_stats(guild_id);
```

### 4. Deploy slash commands

```bash
node deploy-commands.js
```

### 5. Chạy bot

```bash
npm start
# hoặc
node index.js
```

---

## 🐳 Deploy bằng Docker

```bash
docker build -t discord-bot-diemdanh .
docker run -d --env-file .env discord-bot-diemdanh
```

---

## 🌐 Deploy Wispbyte (Miễn Phí)

1. Đăng nhập [wispbyte.com](https://wispbyte.com) → tạo server **Node.js**
2. Upload toàn bộ project (trừ `.env` và `node_modules`)
3. **Environment Variables**: điền đủ 4 biến trong `.env.example`
4. Startup command: `node index.js`
5. **Start** server

---

## 📁 Cấu Trúc Dự Án

```
discord-bot-diemdanh/
├── index.js                    # Entry point, khởi tạo client & load handlers
├── db.js                       # Supabase client + toàn bộ thao tác DB
├── deploy-commands.js          # Đăng ký slash commands lên Discord
├── .env.example                # Mẫu biến môi trường
├── Dockerfile
├── commands/
│   ├── batdau.js               # /batdau_diemdanh
│   ├── ketthuc.js              # /ket_thuc_diemdanh
│   ├── huy.js                  # /huy_diemdanh
│   ├── them.js                 # /them_diemdanh
│   ├── sua.js                  # /sua_diemdanh
│   ├── xoa.js                  # /xoa_diemdanh
│   ├── xem.js                  # /xem_diemdanh
│   ├── lichsu.js               # /lich_su
│   ├── thongke.js              # /thong_ke
│   ├── xuat.js                 # /xuat_diemdanh
│   ├── lichsu_member.js        # /xem_lich_su_member
│   ├── thongke_phien.js        # /thong_ke_phien
│   ├── nhacnho.js              # /nhac_nho
│   ├── setup.js                # /caidat_role, /caidat_admin_role, /caidat_xem
│   ├── lich.js                 # /lich_them, /lich_xem, /lich_xoa, /lich_phai
│   └── help.js                 # /help
├── handlers/
│   ├── buttonHandler.js        # Router nút bấm
│   ├── commandHandler.js       # Router slash commands
│   ├── button/
│   │   ├── attendHandler.js    # Nút điểm danh (join/late/decline)
│   │   └── closeHandler.js     # Nút đóng phiên + xác nhận
│   └── setup/                  # UI handlers cài đặt
├── events/
│   ├── interactionCreate.js    # Router tất cả interaction
│   └── ready.js                # Bot online → khôi phục scheduler
└── utils/
    ├── embeds.js               # Embed builders (session, summary, history…)
    ├── session.js              # ketThucPhien, thongBaoHuyHieu, guiCsvDinhKem…
    ├── scheduler.js            # Lịch cố định: mở/đóng tự động hàng tuần
    ├── timers.js               # Auto-close & reminder timers
    ├── timeCalc.js             # msToNextWeekday, msFromOpenToClose…
    ├── permissions.js          # requireAdmin, requireRole
    ├── helpers.js              # Utility functions
    ├── logger.js               # Structured logger
    ├── errorHandler.js         # Global error handler
    ├── dbRetry.js              # DB retry wrapper
    └── progress.js             # Progress bar UI
```

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|---|---|
| Runtime | Node.js 18+ |
| Language | JavaScript (CommonJS) |
| Discord | discord.js v14 |
| Database | Supabase (PostgreSQL) |
| Deploy | Docker / Wispbyte / Railway / Render |

---

## 📝 Biến Môi Trường

| Biến | Mô tả |
|---|---|
| `DISCORD_TOKEN` | Bot token — lấy tại [Discord Developer Portal](https://discord.com/developers/applications) |
| `CLIENT_ID` | Application ID của bot |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_KEY` | `service_role` key (không phải `anon`) |

> ⚠️ Dùng **service_role key** để bot có quyền ghi DB. **Không commit `.env` lên git.**

---

## 🔐 Discord Bot Permissions

Khi invite bot, đảm bảo bật:
- `Send Messages`
- `Embed Links`
- `Read Message History`
- `Use Slash Commands`
- `Manage Messages` *(để chỉnh sửa embed real-time)*
- `Attach Files` *(để gửi CSV đính kèm)*

**Gateway Intents cần bật trong Developer Portal:**
- `GUILDS`
- `GUILD_MEMBERS` *(Privileged — phải bật thủ công)*

---

## ⚙️ Logic Quan Trọng

### Scheduler (Lịch Cố Định)
- Mỗi lịch giữ 2 timer: `{id}_open` và `{id}_close`
- Timer mới luôn clear timer cũ trước khi set → không có zombie timer
- Close timer gọi thẳng `_dongPhienVaThongKe` (không qua `runDongLich`) để tránh double-reschedule
- Khi bot restart: `_khoiPhucCloseTimer` tính lại `msRemaining` từ `session.created_at`

### Streak
- Cộng `+1` khi thành viên có mặt (`tham_gia` hoặc `tre`)
- Reset về `0` khi thành viên **eligible** vắng mặt
- `max_streak` không bao giờ giảm

### eligible_member_ids
- `null` = tất cả thành viên có thể điểm danh (không lọc)
- `[]` (mảng rỗng) = không ai được điểm danh
- Luôn dùng `session.eligible_member_ids ?? []` để tránh crash `.length`
