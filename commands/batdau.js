// commands/batdau.js
const {
  SlashCommandBuilder,
} = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons, replyWarnEdit } = require('../utils/embeds.js');
const { datHenGioDong } = require('../utils/timers.js'); // FIX B-2: datHenGioTuDong → datHenGioDong
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bat_dau')
    .setDescription('Bắt đầu phiên điểm danh mới')
    .setDefaultMemberPermissions(0n)
    .addStringOption(o =>
      o.setName('ten').setDescription('Tên phiên (VD: Bang Chiến T7)').setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('phut').setDescription('Tự động đóng sau X phút (0 = không tự động)').setRequired(false).setMinValue(0)
    )
    .addRoleOption(o =>
      o.setName('phai').setDescription('Chỉ điểm danh phái này (bỏ trống = tất cả)').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const { guild, member, channel } = interaction;

    const { ok, cfg } = await requireAdmin(interaction, { context: '/bat_dau' });
    if (!ok) return;

    const existing = await db.getActiveSession(guild.id);
    if (existing) {
      return interaction.editReply(replyWarnEdit('⚠️ Đã có phiên đang mở. Đóng phiên cũ trước khi bắt đầu phiên mới.'));
    }

    const tenOption  = interaction.options.getString('ten');
    const phutOption = interaction.options.getInteger('phut') ?? 0;
    const phaiRole   = interaction.options.getRole('phai');

    let eligibleIds   = [];
    let roleName      = 'Tất cả';
    let allowedRoleId = null;

    if (phaiRole) {
      roleName      = phaiRole.name;
      allowedRoleId = phaiRole.id;
      await guild.members.fetch();
      eligibleIds = guild.members.cache
        .filter(m => m.roles.cache.has(phaiRole.id))
        .map(m => m.id);
    } else if (cfg.phai_role_ids?.length) {
      await guild.members.fetch();
      const allIds = new Set();
      for (const rid of cfg.phai_role_ids) {
        guild.members.cache
          .filter(m => m.roles.cache.has(rid))
          .forEach(m => allIds.add(m.id));
      }
      eligibleIds = [...allIds];
      roleName = 'Các phái';
    } else {
      await guild.members.fetch();
      eligibleIds = guild.members.cache.filter(m => !m.user.bot).map(m => m.id);
    }

    const autoCloseAt = phutOption > 0
      ? new Date(Date.now() + phutOption * 60_000).toISOString()
      : null;

    const sessionName = tenOption ?? `Điểm danh ${new Date().toLocaleDateString('vi-VN')}`;

    // FIX B-4: createSession nhận positional args, không phải object
    const session = await db.createSession(
      guild.id,
      sessionName,
      member.user.tag,
      autoCloseAt,
      channel.id,
      eligibleIds,
    );

    // Lưu allowed_role_id vào session nếu có (update riêng sau khi tạo)
    if (allowedRoleId) {
      await db.supabase
        .from('sessions')
        .update({ allowed_role_id: allowedRoleId, role_name: roleName })
        .eq('id', session.id);
      session.allowed_role_id = allowedRoleId;
      session.role_name = roleName;
    }

    const attended    = [];
    const phaiRoleIds = phaiRole ? [phaiRole.id] : (cfg.phai_role_ids ?? []);
    const embed       = await buildSessionEmbed(guild, session, attended, phaiRoleIds);
    const buttons     = buildAttendanceButtons(false);

    const msg = await interaction.editReply({ embeds: [embed], components: [buttons] });
    await db.updateSessionMessageId(session.id, msg.id);

    if (phutOption > 0) {
      // FIX B-2: đúng signature datHenGioDong(client, guild, session, channelId, ms)
      datHenGioDong(interaction.client, guild, session, channel.id, phutOption * 60_000);
    }
  },
};
