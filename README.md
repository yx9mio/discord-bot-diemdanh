# ⚔️ Bot Điểm Danh Bang Chiến

> Bot Discord quản lý điểm danh bang chiến với nút bấm trực quan, tự động cập nhật danh sách real-time vào một channel riêng.

---

## ✨ Tính Năng

- 🎮 **Nút bấm điểm danh** — thành viên chọn *Tham Gia* hoặc *Không Tham Gia* chỉ bằng 1 click
- 📋 **Cập nhật real-time** — danh sách hiển thị ngay sau mỗi lần điểm danh
- 📺 **Channel riêng biệt** — tự động tạo `#diemdanh-bang-chien` để pin kết quả
- 🔄 **Đổi trạng thái** — thành viên có thể đổi Tham Gia ↔ Không Tham Gia bất kỳ lúc nào
- 🛡️ **Phân quyền rõ ràng** — chỉ Admin mới mở/đóng phiên điểm danh
- ✏️ **Quản lý thủ công** — Admin thêm/xóa điểm danh cho từng thành viên nếu cần
- 💾 **Persistent Buttons** — nút bấm vẫn hoạt động sau khi bot khởi động lại

---

## 📁 Cấu Trúc Dự Án

```
discord-bot-diemdanh/
├── bot.py            ← Code chính
├── requirements.txt  ← Thư viện Python
├── .env.example      ← Mẫu file cấu hình
└── README.md         ← Hướng dẫn này
```

---

## 🚀 Cài Đặt & Chạy

### Bước 1 — Tạo Bot trên Discord Developer Portal

1. Vào [discord.com/developers/applications](https://discord.com/developers/applications)
2. Nhấn **New Application** → đặt tên → **Create**
3. Vào tab **Bot** → bật các Privileged Gateway Intents:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
4. *(Tuỳ chọn)* Tắt **Public Bot** nếu chỉ dùng nội bộ
5. Nhấn **Reset Token** → copy và giữ bí mật token này

### Bước 2 — Mời Bot vào Server

Vào **OAuth2 → URL Generator**, chọn:

| Scopes | Bot Permissions |
|--------|----------------|
| `bot` | `Send Messages` |
| `applications.commands` | `Embed Links` |
| | `Manage Channels` |
| | `Read Message History` |
| | `View Channels` |

Copy URL tạo ra → mở trình duyệt → chọn server → **Authorize**.

### Bước 3 — Cài Thư Viện

> Yêu cầu **Python 3.10+**

```bash
# Tạo môi trường ảo (khuyến khích)
python -m venv venv
source venv/bin/activate       # Linux / macOS
venv\Scripts\activate          # Windows

# Cài thư viện
pip install -r requirements.txt
```

### Bước 4 — Cấu Hình Token

Tạo file `.env` trong cùng thư mục với `bot.py`:

```env
DISCORD_TOKEN=token_cua_ban_o_day
```

Hoặc copy từ file mẫu:

```bash
cp .env.example .env
# Mở .env và điền token thật vào
```

### Bước 5 — Chạy Bot

```bash
python bot.py
```

Nếu thấy dòng `✅ Bot đã online` trong terminal là thành công.

---

## 📖 Danh Sách Lệnh

### 🛡️ Admin — cần quyền *Manage Server*

| Lệnh | Mô tả |
|------|-------|
| `/batdau_diemdanh [ten_tran]` | Mở phiên điểm danh mới, đăng thông báo + nút bấm |
| `/ket_thuc_diemdanh` | Đóng phiên, đánh dấu kết thúc, hiển thị tổng kết |
| `/them_diemdanh @member trang_thai` | Thêm điểm danh thủ công cho thành viên |
| `/xoa_diemdanh @member` | Xóa điểm danh của một thành viên |

### 👥 Thành Viên — ai cũng dùng được

| Hành động | Mô tả |
|-----------|-------|
| Nút **✅ Tham Gia** | Điểm danh tham gia bang chiến |
| Nút **❌ Không Tham Gia** | Điểm danh không tham gia |
| `/xem_diemdanh` | Xem danh sách hiện tại (chỉ mình bạn thấy — ephemeral) |

---

## ☁️ Deploy 24/7

### Render *(khuyến nghị — đơn giản nhất)*

1. Push code lên GitHub
2. Vào [render.com](https://render.com) → **New → Background Worker**
3. Kết nối repo GitHub
4. Cấu hình:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python bot.py`
5. Thêm **Environment Variable:** `DISCORD_TOKEN` = token của bạn
6. Nhấn **Deploy** — xong!

> ⚠️ Chọn **Background Worker**, không phải Web Service, để bot không bị ngủ.

### Replit

1. Tạo **Python Repl** mới, upload code
2. Vào **Secrets** → thêm key `DISCORD_TOKEN` = token của bạn
3. Tạo file `.replit`:
   ```toml
   run = "python bot.py"
   ```
4. Vào **Deployments** → chọn **Reserved VM** → Deploy

### Fly.io

Thêm file `Dockerfile` vào project:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "bot.py"]
```

```bash
flyctl launch
flyctl secrets set DISCORD_TOKEN=token_cua_ban
flyctl deploy
```

---

## ⚠️ Lưu Ý Quan Trọng

- **Dữ liệu lưu trong RAM** — nếu bot restart, phiên đang mở sẽ mất. Để lưu bền vững qua các lần restart, cần nâng cấp thêm SQLite hoặc JSON.
- **Mỗi server chỉ có 1 phiên** điểm danh cùng lúc. Phải kết thúc phiên cũ trước khi mở phiên mới.
- **Channel `#diemdanh-bang-chien`** được tạo tự động nếu chưa tồn tại. Thành viên chỉ đọc, không gửi tin được.
- **Không commit file `.env`** lên GitHub — token bị lộ sẽ phải reset ngay lập tức.

---

## 🛠️ Yêu Cầu Hệ Thống

| Thành phần | Phiên bản |
|------------|-----------|
| Python | 3.10 trở lên |
| discord.py | 2.3.2 trở lên |
| python-dotenv | 1.0.0 trở lên |
