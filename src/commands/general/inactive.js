// src/commands/general/inactive.js
// Hiển thị danh sách thành viên không hoạt động (vắng nhiều).
// Admin-only, ephemeral. Tính dựa trên member_stats.
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { buildInactiveEmbed } = require('../../../utils/inactiveHelper.js');
const log = require('../../../utils/logger.js');

class InactiveCommand extends Command {
  constructor(context) {
    super(context, { name: 'inactive', description: 'Danh sách thành viên vắng nhiều (admin)' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('inactive')
        .setDescription('Danh sách thành viên vắng nhiều nhất')
        .addIntegerOption(opt =>
          opt.setName('nguong')
            .setDescription('Tỷ lệ vắng tối thiểu (%) — mặc định: 50')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('so_luong')
            .setDescription('Số thành viên hiển thị tối đa (mặc định: 20)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('so_phien_toi_thieu')
            .setDescription('Số phiên tối thiểu để tính (mặc định: 3)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
        ),
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'xem inactive', deferred: true });
    if (!ok) return;

    const nguong        = interaction.options.getInteger('nguong')        ?? 50;
    const soLuong       = interaction.options.getInteger('so_luong')       ?? 20;
    const soPhienToiThieu = interaction.options.getInteger('so_phien_toi_thieu') ?? 3;

    try {
      const { embed, total } = await buildInactiveEmbed({
        guild:     interaction.guild,
        nguong,
        soLuong,
        soPhienToiThieu,
      });

      log.info('INACTIVE', interaction.guildId,
        '%s xem inactive (nguong=%d%%, min_sessions=%d, result=%d)',
        interaction.user.tag, nguong, soPhienToiThieu, total);

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      log.error('INACTIVE', interaction.guildId, 'buildInactiveEmbed lỗi: %s', e.message);
      return interaction.editReply({ content: '\u274c Không thể tải dữ liệu, thử lại sau.' });
    }
  }
}

module.exports = { InactiveCommand };
