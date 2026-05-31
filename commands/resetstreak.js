// commands/resetstreak.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyConfirm, replyOkEdit, replyWarnEdit, replyErrEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

const CONFIRM_ID = 'confirm:resetstreak:yes';
const CANCEL_ID  = 'confirm:resetstreak:no';
const TIMEOUT_MS = 30_000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_streak')
    .setDescription('[Admin] Reset streak điểm danh của một thành viên')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần reset streak').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, user } = interaction;

    const { ok } = await requireAdmin(interaction, { context: '/reset_streak' });
    if (!ok) return;

    const target = interaction.options.getUser('thanh_vien');
    const stats  = await db.getMemberStats(guild.id, target.id);
    const streak = stats?.current_streak ?? 0;

    // Gửi embed xác nhận với streak hiện tại
    await interaction.editReply(
      replyConfirm(
        `Bạn có chắc muốn **reset streak** của <@${target.id}>?\n` +
        `> Streak hiện tại: **${streak}** → sẽ về **0**.`,
        CONFIRM_ID,
        CANCEL_ID,
      )
    );

    const reply     = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === user.id,
      max: 1,
      time: TIMEOUT_MS,
    });

    collector.on('collect', async i => {
      await i.deferUpdate();

      if (i.customId === CONFIRM_ID) {
        await db.resetMemberStreak(guild.id, target.id);
        return interaction.editReply({
          ...replyOkEdit(`Đã reset streak của <@${target.id}> về **0**. (trước: ${streak})`),
          components: [],
        });
      }

      return interaction.editReply({ ...replyWarnEdit('Đã hủy thao tác. Streak không thay đổi.'), components: [] });
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        await interaction.editReply({ ...replyWarnEdit('⏰ Hết thời gian xác nhận. Streak không thay đổi.'), components: [] }).catch(() => null);
      }
    });
  },
};
