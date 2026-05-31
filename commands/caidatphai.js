// commands/caidatphai.js — Quản lý role phái cho lịch cố định
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('cai_dat_phai')
  .setDescription('Quản lý role phái cho lịch điểm danh cố định')
  .addSubcommand(s =>
    s.setName('them')
      .setDescription('Thêm role phái vào lịch')
      .addStringOption(o => o.setName('lich_id').setDescription('ID lịch (/lich_co_dinh xem để lấy ID)').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role phái cần thêm').setRequired(true))
  )
  .addSubcommand(s =>
    s.setName('xoa')
      .setDescription('Xóa role phái khỏi lịch')
      .addStringOption(o => o.setName('lich_id').setDescription('ID lịch').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role phái cần xóa').setRequired(true))
  )
  .addSubcommand(s =>
    s.setName('xem')
      .setDescription('Xem danh sách role phái của lịch')
      .addStringOption(o => o.setName('lich_id').setDescription('ID lịch').setRequired(true))
  )
  .addSubcommand(s =>
    s.setName('xoa_het')
      .setDescription('Xóa hết role phái (dùng role cao nhất để nhóm)')
      .addStringOption(o => o.setName('lich_id').setDescription('ID lịch').setRequired(true))
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg))
    return interaction.editReply({ content: '🔒 Bạn không có quyền.' });

  const sub    = interaction.options.getSubcommand();
  const lichId = interaction.options.getString('lich_id');
  const lich   = await db.getLichCoDinhById(guild.id, lichId)
               ?? await db.getLichCoDinhByShortId(guild.id, lichId);

  if (!lich)
    return interaction.editReply({ content: `⚠️ Không tìm thấy lịch \`${lichId}\`. Dùng \`/lich_co_dinh xem\` để lấy ID.` });

  // ── Xem ─────────────────────────────────────────────────────────────────────
  if (sub === 'xem') {
    const ids = lich.phai_role_ids ?? [];
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle(`🎯 Role Phái — ${lich.session_name}`)
      .setDescription(
        ids.length
          ? ids.map((id, i) => `**${i+1}.** <@&${id}> \`${id}\``).join('\n')
          : '_Chưa có role phái nào. Bot sẽ nhóm theo role cao nhất của mỗi member._'
      )
      .addFields({ name: 'ID Lịch', value: `\`${lich.id}\``, inline: true })
      .setColor(0x5865F2)
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  const role = interaction.options.getRole('role');
  const cur  = lich.phai_role_ids ?? [];

  // ── Thêm ───────────────────────────────────────────────────────────────────
  if (sub === 'them') {
    if (cur.includes(role.id))
      return interaction.editReply({ content: `⚠️ <@&${role.id}> đã là role phái của lịch này rồi.` });
    if (cur.length >= 10)
      return interaction.editReply({ content: '⚠️ Tối đa 10 role phái mỗi lịch.' });

    await db.capNhatPhaiRoles(lich.id, [...cur, role.id]);
    return interaction.editReply({
      content: `✅ Đã thêm <@&${role.id}> vào phái của **${lich.session_name}**. (${cur.length + 1}/10)`,
    });
  }

  // ── Xóa ────────────────────────────────────────────────────────────────────
  if (sub === 'xoa') {
    if (!cur.includes(role.id))
      return interaction.editReply({ content: `⚠️ <@&${role.id}> không phải role phái của lịch này.` });

    await db.capNhatPhaiRoles(lich.id, cur.filter(id => id !== role.id));
    return interaction.editReply({
      content: `🗑️ Đã xóa <@&${role.id}> khỏi phái của **${lich.session_name}**. Còn ${cur.length - 1} role.`,
    });
  }

  // ── Xóa hết ────────────────────────────────────────────────────────────────
  if (sub === 'xoa_het') {
    await db.capNhatPhaiRoles(lich.id, []);
    return interaction.editReply({
      content: `✅ Đã xóa hết role phái của **${lich.session_name}**. Bot sẽ nhóm theo role cao nhất.`,
    });
  }
}

module.exports = { data, execute };
