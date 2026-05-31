'use strict';
const { EmbedBuilder } = require('discord.js');
const { runSuite, buildEmbed } = require('../tests/testRunner.js');

const dbSuite                = require('../tests/suites/db.suite.js');
const sessionSuite           = require('../tests/suites/session.suite.js');
const attendanceSuite        = require('../tests/suites/attendance.suite.js');
const memberStatsSuite       = require('../tests/suites/memberStats.suite.js');
const scheduledSessionSuite  = require('../tests/suites/scheduledSession.suite.js');
const badgesSuite            = require('../tests/suites/badges.suite.js');
const configSuite            = require('../tests/suites/config.suite.js');
const helpersSuite           = require('../tests/suites/helpers.suite.js');

const SUITES = [
  { label: '📡 DB Connectivity',      fn: dbSuite },
  { label: '🔄 Session CRUD',         fn: sessionSuite },
  { label: '✅ Attendance Flow',       fn: attendanceSuite },
  { label: '📊 Member Stats',         fn: memberStatsSuite },
  { label: '📅 Scheduled Sessions',   fn: scheduledSessionSuite },
  { label: '🏅 Badges',               fn: badgesSuite },
  { label: '⚙️  Config',              fn: configSuite },
  { label: '🔧 Helper Functions',     fn: helpersSuite },
];

async function testBotHandler(interaction) {
  const { guild, member } = interaction;

  // Admin only
  if (!member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Chỉ admin mới dùng được lệnh này.', ephemeral: true });
  }

  // Defer ephemeral ngay
  await interaction.deferReply({ ephemeral: true });

  const guildId  = guild.id;
  const startAll = Date.now();

  // Thông báo đang chạy
  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle('⏳ Đang chạy test suite...')
      .setDescription(`${SUITES.length} suites • please wait`)
    ],
  });

  // Chạy tất cả suite tuần tự (tránh race condition trên cùng guild)
  const suiteResults = [];
  for (const suite of SUITES) {
    const result = await runSuite(suite.label, suite.fn, guildId, interaction.client);
    suiteResults.push(result);
  }

  const totalDuration = Date.now() - startAll;
  const embedData = buildEmbed(suiteResults, totalDuration);

  // Discord embed có giới hạn field value 1024 chars — cắt nếu cần
  for (const f of embedData.fields) {
    if (f.value.length > 1024) {
      f.value = f.value.slice(0, 1020) + '…';
    }
  }

  await interaction.editReply({
    embeds: [new EmbedBuilder(embedData)],
  });
}

module.exports = { testBotHandler };
