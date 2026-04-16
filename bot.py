"""
Discord Bot - Điểm Danh Bang Chiến
Tác giả: Perplexity AI
"""

import os
from datetime import datetime

import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

from storage import SessionStore

load_dotenv()

# ── Intents ──────────────────────────────────────────────────────────────────
intents = discord.Intents.default()
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)


# ══════════════════════════════════════════════════════════════════════════════
#  PERSISTENT VIEW (Buttons)
# ══════════════════════════════════════════════════════════════════════════════
class AttendanceView(discord.ui.View):
    """View chứa 2 nút Tham Gia / Không Tham Gia — timeout=None để tồn tại vĩnh viễn."""

    def __init__(self):
        super().__init__(timeout=None)

    # ── Nút Tham Gia ─────────────────────────────────────────────────────────
    @discord.ui.button(
        label="✅  Tham Gia",
        style=discord.ButtonStyle.success,
        custom_id="btn_tham_gia",
    )
    async def btn_tham_gia(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        await _mark_attendance(interaction, "tham_gia")

    # ── Nút Không Tham Gia ───────────────────────────────────────────────────
    @discord.ui.button(
        label="❌  Không Tham Gia",
        style=discord.ButtonStyle.danger,
        custom_id="btn_khong_tham_gia",
    )
    async def btn_khong_tham_gia(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        await _mark_attendance(interaction, "khong_tham_gia")


# ══════════════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════
async def _mark_attendance(interaction: discord.Interaction, status: str):
    """Ghi nhận điểm danh và cập nhật display channel."""
    gid = interaction.guild_id
    session = SessionStore.get(gid)
    if not session:
        await interaction.response.send_message(
            "⚠️ Hiện không có phiên điểm danh nào đang mở!", ephemeral=True
        )
        return

    uid = interaction.user.id
    old_status = session["attendees"].get(str(uid), {}).get("status")
    session["attendees"][str(uid)] = {
        "name": interaction.user.display_name,
        "avatar": str(interaction.user.display_avatar.url),
        "status": status,
        "time": datetime.now().strftime("%H:%M:%S"),
    }
    SessionStore.set(gid, session)

    await _update_display(interaction.guild)

    label = "✅ Tham Gia" if status == "tham_gia" else "❌ Không Tham Gia"
    if old_status and old_status != status:
        msg = (
            f"🔄 Đã **đổi** điểm danh sang **{label}** cho {interaction.user.mention}!"
        )
    else:
        msg = f"{label} — đã điểm danh thành công cho {interaction.user.mention}!"

    await interaction.response.send_message(msg, ephemeral=True)


async def _build_display_embed(session: dict, closed: bool = False) -> discord.Embed:
    """Tạo embed hiển thị danh sách điểm danh."""
    attendees = session["attendees"]
    tham_gia = [(uid, d) for uid, d in attendees.items() if d["status"] == "tham_gia"]
    khong_tham_gia = [
        (uid, d) for uid, d in attendees.items() if d["status"] == "khong_tham_gia"
    ]

    prefix = "🏆 [ĐÃ KẾT THÚC]" if closed else "📋 Điểm Danh Bang Chiến"
    color = discord.Color.green() if closed else discord.Color.blurple()

    embed = discord.Embed(
        title=f"{prefix}: {session['session_name']}",
        color=color,
        timestamp=datetime.now(),
    )

    # Tham gia
    tg_text = (
        "\n".join(
            f"`{i + 1:>2}.` {d['name']}  *(lúc {d['time']})*"
            for i, (_, d) in enumerate(tham_gia)
        )
        or "_Chưa có ai_"
    )
    embed.add_field(
        name=f"✅  Tham Gia  —  **{len(tham_gia)}**", value=tg_text, inline=False
    )

    # Không tham gia
    ktg_text = (
        "\n".join(
            f"`{i + 1:>2}.` {d['name']}  *(lúc {d['time']})*"
            for i, (_, d) in enumerate(khong_tham_gia)
        )
        or "_Chưa có ai_"
    )
    embed.add_field(
        name=f"❌  Không Tham Gia  —  **{len(khong_tham_gia)}**",
        value=ktg_text,
        inline=False,
    )

    embed.set_footer(
        text=f"Tổng đã điểm danh: {len(attendees)} thành viên  •  Bắt đầu: {session['start_time']}"
    )
    return embed


async def _update_display(guild: discord.Guild):
    """Cập nhật tin nhắn trong display channel."""
    gid = guild.id
    session = SessionStore.get(gid)
    if not session:
        return
    channel = guild.get_channel(session["display_channel_id"])
    if not channel:
        return
    embed = await _build_display_embed(session)
    try:
        msg = await channel.fetch_message(session["display_message_id"])
        await msg.edit(embed=embed)
    except Exception:
        pass


async def _get_or_create_display_channel(guild: discord.Guild) -> discord.TextChannel:
    """Lấy hoặc tạo channel #diemdanh-bang-chien."""
    ch = discord.utils.get(guild.text_channels, name="diemdanh-bang-chien")
    if ch:
        return ch
    overwrites = {
        guild.default_role: discord.PermissionOverwrite(
            send_messages=False, read_messages=True, add_reactions=False
        ),
        guild.me: discord.PermissionOverwrite(send_messages=True, manage_messages=True),
    }
    ch = await guild.create_text_channel(
        "diemdanh-bang-chien",
        overwrites=overwrites,
        topic="📋 Danh sách điểm danh Bang Chiến — Tự động cập nhật",
        reason="Bot tạo channel hiển thị điểm danh",
    )
    return ch


# ══════════════════════════════════════════════════════════════════════════════
#  BOT EVENTS
# ══════════════════════════════════════════════════════════════════════════════
@bot.event
async def on_ready():
    bot.add_view(AttendanceView())  # Đăng ký persistent view
    try:
        synced = await bot.tree.sync()
        print(f"✅ Synced {len(synced)} slash commands")
    except Exception as e:
        print(f"❌ Lỗi sync commands: {e}")
    print(f"🤖 Bot đã online: {bot.user}  (ID: {bot.user.id})")
    print("─" * 40)


# ══════════════════════════════════════════════════════════════════════════════
#  SLASH COMMANDS
# ══════════════════════════════════════════════════════════════════════════════


# ── /batdau_diemdanh ─────────────────────────────────────────────────────────
@bot.tree.command(
    name="batdau_diemdanh",
    description="[Admin] Bắt đầu phiên điểm danh bang chiến mới",
)
@app_commands.describe(ten_tran="Tên trận / ngày tháng (VD: Tối 11/04/2026)")
@app_commands.checks.has_permissions(manage_guild=True)
async def batdau_diemdanh(interaction: discord.Interaction, ten_tran: str = None):
    gid = interaction.guild_id

    if SessionStore.get(gid):
        await interaction.response.send_message(
            "⚠️ Đã có phiên điểm danh đang mở! Dùng `/ket_thuc_diemdanh` trước.",
            ephemeral=True,
        )
        return

    if not ten_tran:
        ten_tran = f"Bang Chiến {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    await interaction.response.defer(ephemeral=False)

    # Lấy / tạo display channel
    display_ch = await _get_or_create_display_channel(interaction.guild)

    # Khởi tạo session
    session = {
        "session_name": ten_tran,
        "attendees": {},
        "display_channel_id": display_ch.id,
        "display_message_id": None,
        "start_time": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }

    # Gửi embed vào display channel
    init_embed = await _build_display_embed(session)
    display_msg = await display_ch.send(embed=init_embed)
    session["display_message_id"] = display_msg.id

    # Lưu vào JSON
    SessionStore.set(gid, session)

    # Gửi thông báo + nút điểm danh vào channel hiện tại
    announce_embed = discord.Embed(
        title=f"⚔️  Mở Điểm Danh: {ten_tran}",
        description=(
            "Nhấn nút bên dưới để điểm danh!\n\n"
            f"📊 Kết quả cập nhật tại {display_ch.mention}"
        ),
        color=discord.Color.gold(),
        timestamp=datetime.now(),
    )
    announce_embed.set_footer(text="Chỉ thành viên trong server mới có thể điểm danh")
    view = AttendanceView()
    await interaction.followup.send(embed=announce_embed, view=view)


# ── /ket_thuc_diemdanh ────────────────────────────────────────────────────────
@bot.tree.command(
    name="ket_thuc_diemdanh",
    description="[Admin] Kết thúc phiên điểm danh hiện tại",
)
@app_commands.checks.has_permissions(manage_guild=True)
async def ket_thuc_diemdanh(interaction: discord.Interaction):
    gid = interaction.guild_id
    session = SessionStore.get(gid)
    if not session:
        await interaction.response.send_message(
            "⚠️ Không có phiên điểm danh nào đang mở!", ephemeral=True
        )
        return

    await interaction.response.defer()

    # Cập nhật display channel lần cuối với trạng thái "đã kết thúc"
    channel = interaction.guild.get_channel(session["display_channel_id"])
    if channel and session["display_message_id"]:
        try:
            closed_embed = await _build_display_embed(session, closed=True)
            msg = await channel.fetch_message(session["display_message_id"])
            await msg.edit(embed=closed_embed)
        except Exception:
            pass

    # Tổng kết
    attendees = session["attendees"]
    tham_gia = [d for d in attendees.values() if d["status"] == "tham_gia"]
    khong_tham_gia = [d for d in attendees.values() if d["status"] == "khong_tham_gia"]

    summary = discord.Embed(
        title=f"🏁  Kết Thúc Điểm Danh: {session['session_name']}",
        color=discord.Color.green(),
        timestamp=datetime.now(),
    )
    summary.add_field(name="✅ Tham Gia", value=str(len(tham_gia)), inline=True)
    summary.add_field(
        name="❌ Không Tham Gia", value=str(len(khong_tham_gia)), inline=True
    )
    summary.add_field(name="📊 Tổng Cộng", value=str(len(attendees)), inline=True)
    if channel:
        summary.add_field(name="📋 Xem chi tiết", value=channel.mention, inline=False)

    SessionStore.delete(gid)
    await interaction.followup.send(embed=summary)


# ── /xem_diemdanh ─────────────────────────────────────────────────────────────
@bot.tree.command(
    name="xem_diemdanh",
    description="Xem danh sách điểm danh hiện tại",
)
async def xem_diemdanh(interaction: discord.Interaction):
    gid = interaction.guild_id
    session = SessionStore.get(gid)
    if not session:
        await interaction.response.send_message(
            "⚠️ Không có phiên điểm danh nào đang mở!", ephemeral=True
        )
        return
    embed = await _build_display_embed(session)
    await interaction.response.send_message(embed=embed, ephemeral=True)


# ── /xoa_diemdanh ─────────────────────────────────────────────────────────────
@bot.tree.command(
    name="xoa_diemdanh",
    description="[Admin] Xóa điểm danh của một thành viên",
)
@app_commands.describe(member="Thành viên cần xóa điểm danh")
@app_commands.checks.has_permissions(manage_guild=True)
async def xoa_diemdanh(interaction: discord.Interaction, member: discord.Member):
    gid = interaction.guild_id
    session = SessionStore.get(gid)
    if not session:
        await interaction.response.send_message(
            "⚠️ Không có phiên điểm danh nào đang mở!", ephemeral=True
        )
        return
    uid_str = str(member.id)
    if uid_str not in session["attendees"]:
        await interaction.response.send_message(
            f"⚠️ {member.display_name} chưa điểm danh!", ephemeral=True
        )
        return
    del session["attendees"][uid_str]
    SessionStore.set(gid, session)
    await _update_display(interaction.guild)
    await interaction.response.send_message(
        f"🗑️ Đã xóa điểm danh của **{member.display_name}**.", ephemeral=True
    )


# ── /them_diemdanh ─────────────────────────────────────────────────────────────
@bot.tree.command(
    name="them_diemdanh",
    description="[Admin] Thêm điểm danh thủ công cho thành viên",
)
@app_commands.describe(
    member="Thành viên cần thêm",
    trang_thai="Trạng thái: tham_gia hoặc khong_tham_gia",
)
@app_commands.choices(
    trang_thai=[
        app_commands.Choice(name="✅ Tham Gia", value="tham_gia"),
        app_commands.Choice(name="❌ Không Tham Gia", value="khong_tham_gia"),
    ]
)
@app_commands.checks.has_permissions(manage_guild=True)
async def them_diemdanh(
    interaction: discord.Interaction,
    member: discord.Member,
    trang_thai: app_commands.Choice[str],
):
    gid = interaction.guild_id
    session = SessionStore.get(gid)
    if not session:
        await interaction.response.send_message(
            "⚠️ Không có phiên điểm danh nào đang mở!", ephemeral=True
        )
        return
    session["attendees"][str(member.id)] = {
        "name": member.display_name,
        "avatar": str(member.display_avatar.url),
        "status": trang_thai.value,
        "time": datetime.now().strftime("%H:%M:%S"),
    }
    SessionStore.set(gid, session)
    await _update_display(interaction.guild)
    label = "✅ Tham Gia" if trang_thai.value == "tham_gia" else "❌ Không Tham Gia"
    await interaction.response.send_message(
        f"✏️ Đã thêm điểm danh **{label}** cho **{member.display_name}**.",
        ephemeral=True,
    )


# ══════════════════════════════════════════════════════════════════════════════
#  ERROR HANDLERS
# ══════════════════════════════════════════════════════════════════════════════
async def _missing_perms(interaction: discord.Interaction, error):
    if isinstance(error, app_commands.MissingPermissions):
        await interaction.response.send_message(
            "🚫 Bạn không có quyền sử dụng lệnh này!", ephemeral=True
        )


batdau_diemdanh.error(_missing_perms)
ket_thuc_diemdanh.error(_missing_perms)
xoa_diemdanh.error(_missing_perms)
them_diemdanh.error(_missing_perms)


# ══════════════════════════════════════════════════════════════════════════════
#  RUN
# ══════════════════════════════════════════════════════════════════════════════
TOKEN = os.getenv("DISCORD_TOKEN")
if not TOKEN:
    raise SystemExit("❌ Thiếu DISCORD_TOKEN! Thêm vào file .env hoặc biến môi trường.")

bot.run(TOKEN)
