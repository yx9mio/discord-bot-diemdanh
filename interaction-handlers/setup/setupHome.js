// interaction-handlers/setup/setupHome.js
// Handles: setup:home, setup:home:refresh, setup:cfg, setup:sch, setup:mem, setup:history
// Render lại Home dashboard khi user bấm "Làm mới" hoặc quay lại.
//
// (Commit 4 sẽ thêm handler setup:cfg, setup:sch, setup:mem riêng — file này
//  hiện chỉ xử lý refresh + home; các nút kia là stub để tránh lỗi click.)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const { HomeView } = require('../../src/commands/setup/_HomeView.js');
const { CUSTOM_ID } = HomeView;

const KNOWN_IDS = new Set([
  CUSTOM_ID.HOME,
  CUSTOM_ID.REFRESH,
  // CUSTOM_ID.CFG, CUSTOM_ID.SCH, CUSTOM_ID.MEM, CUSTOM_ID.HISTORY
  // → sẽ được handler riêng xử lý ở Commit 4
]);

class SetupHomeHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === CUSTOM_ID.HOME || id === CUSTOM_ID.REFRESH) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild } = interaction;
    const [cfg, schedules, members, session] = await Promise.all([
      db.getGuildConfig(guild.id),
      db.getScheduledSessions(guild.id),
      db.getMembers(guild.id),
      db.getActiveSession(guild.id),
    ]);
    const view = HomeView.render({ guild, cfg, schedules, members, session });
    return interaction.editReply(view);
  }
}

module.exports = { SetupHomeHandler, KNOWN_IDS };
