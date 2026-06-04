# Changelog

## [Unreleased]

### Bug Fixes

#### Fix #9 — `utils/timers.js`: Early return sau `closeSession` thất bại

**Vấn đề:** Khi `closeSession` ném lỗi trong `datHenGioDong()`, code vẫn tiếp tục chạy
các bước post-close (gửi embed summary, badge, CSV...) với session chưa thực sự đóng.

**Fix:** Thêm `return;` ngay sau log lỗi của `closeSession` để dừng sớm,
tránh side-effect với trạng thái DB không nhất quán.

```js
// [#9] Dừng lại khi closeSession lỗi
return;
```

---

#### Fix #10 — `utils/session.js`: Dùng `buildSessionActionRow(true)` để disabled đủ rows

**Vấn đề:** `voHieuHoaNutDiemDanh()` gọi `buildAttendanceButtons(true)` chỉ disable
dropdown select menu, bỏ sót admin buttons và nút đóng phiên.

**Fix:** Thay bằng `buildSessionActionRow(true)` để disable đủ cả 3 ActionRow.

```js
// [#10] đủ 3 rows, tất cả disabled
const disabledComponents = buildSessionActionRow(true);
```

---

#### Fix #6 — `utils/attendanceHandler.js`: Giữ pagination components khi edit embed

**Vấn đề:** Sau mỗi lần điểm danh, `msg.edit()` trong `markAttendance()` chỉ truyền
`buildSessionActionRow(false)`, làm mất pagination buttons (trang trước/sau).

**Fix:** Destructure `components: pagComponents` từ `buildSessionEmbed()` rồi merge
cùng admin rows, giới hạn tổng ≤ 5 rows (Discord limit).

```js
// [#6] Merge admin rows + pagination rows; tổng ≤ 5 rows
const { embed, components: pagComponents } = buildSessionEmbed(...);
const adminRows = buildSessionActionRow(false);
const allComponents = [...adminRows, ...pagComponents].slice(0, 5);
await msg.edit({ embeds: [embed], components: allComponents });
```
