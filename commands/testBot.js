'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test_bot')
    .setDescription('[Admin] Chạy toàn bộ test suite — kiểm tra DB connectivity và CRUD an toàn'),
  // execute được gọi từ commandHandler.js → chuyển sang handler
  async execute(interaction) {
    const { testBotHandler } = require('../handlers/testBotHandler.js');
    return testBotHandler(interaction);
  },
};
