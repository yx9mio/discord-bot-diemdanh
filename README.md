# Discord Bot Điểm Danh Bang Chiến — v3.0

## Tính năng

- Embed đẹp với progress bar tỷ lệ tham gia và màu động
- Chỉ role **Bang Chúng** được điểm danh (đổi được bằng `/caidat_role`)
- Lưu lịch sử 25 phiên gần nhất
- Thống kê thành viên tham gia nhiều nhất
- Export danh sách ra file `.txt`
- Reminder tự động trước khi phiên kết thúc
- Tự động đóng phiên sau X phút do admin đặt
- Ping role khi mở phiên
- Admin thêm/xóa điểm danh thủ công

## Lệnh

| Lệnh | Mô tả |
|------|-------|
| `/batdau_diemdanh` | Mở phiên mới (có thể đặt thời lượng, reminder, ping role) |
| `/ket_thuc_diemdanh` | Đóng phiên hiện tại |
| `/xem_diemdanh` | Xem danh sách hiện tại |
| `/them_diemdanh` | Thêm điểm danh thủ công |
| `/xoa_diemdanh` | Xóa điểm danh một thành viên |
| `/lich_su` | Xem lịch sử các phiên đã kết thúc |
| `/thong_ke` | Top thành viên tham gia nhiều nhất |
| `/xuat_diemdanh` | Export ra file `.txt` |
| `/caidat_role` | Đổi role được phép điểm danh |

## Chạy local

```bash
npm install
cp .env.example .env
# Điền DISCORD_TOKEN vào .env
npm run dev
```

## Build production

```bash
npm run build
npm start
```

## Deploy với Docker

```bash
docker build -t diemdanh-bot .
docker run -e DISCORD_TOKEN=your_token_here diemdanh-bot
```

## Cấu trúc files

```
src/
├── index.ts          # Entry point, xử lý commands & events
├── storage.ts        # Đọc/ghi JSON (sessions, history, config)
├── types.ts          # TypeScript interfaces
└── utils/
    ├── embeds.ts     # Builders cho tất cả Discord embeds
    └── progress.ts   # Progress bar helper
data/                 # Tự tạo khi chạy (gitignored)
```
