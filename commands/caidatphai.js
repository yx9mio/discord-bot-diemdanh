// commands/caidatphai.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('cai_dat_phai')
  .setDescription('Cài danh sách role phái cho server (dùng 1 lần)')
  .addRoleOption(o => o.setName('phai_1').setDescription('Phái 1').setRequired(true))
  .addRoleOption(o => o.setName('phai_2').setDescription('Phái 2'))
  .addRoleOption(o => o.setName('phai_3').setDescription('Phái 3'))
  .addRoleOption(o => o.setName('phai_4').setDescription('Phái 4'))
  .addRoleOption(o => o.setName('phai_5').setDescription('Phái 5'))
  .addRoleOption(o => o.setName('phai_6').setDescription('Phái 6'))
  .addRoleOption(o => o.setName('phai_7').setDescription('Phái 7'))
  .addRoleOption(o => o.setName('phai_8').setDescription('Phái 8'))
  .addRoleOption(o => o.setName('phai_9').setDescription('Phái 9'))
  .addRoleOption(o => o.setName('phai_10').setDescription('Phái 10'))
  .addRoleOption(o => o.setName('phai_11').setDescription('Phái 11'));

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!laAdmin(interaction.member, await db.getConfig(interaction.guild.id)))
    return interaction.editReply({ content: '🔒 Bạn không có quyền.' });

  const phaiRoleIds = [];
  for (let i = 1; i <= 11; i++) {
    const r = interaction.options.getRole(`phai_${i}`);
    if (r) phaiRoleIds.push(r.id);
  }

  await db.setConfig(interaction.guild.id, { phai_role_ids: phaiRoleIds });

  const list = phaiRoleIds.map((id, i) => `${i + 1}. <@&${id}>`).join('\n');
  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('✅ Đã lưu danh sách phái')
    .setDescription(list)
    .setColor(0x57F287)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
