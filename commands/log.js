// commands/log.js — Quản lý Log (UX/UI Discord)
// Xem log từ in-memory ring buffer, filter theo level/tag, xem trạng thái Datadog
'use strict';
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const logger = require('../utils/logger.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_COLOR = { debug: 0x7a39bb, info: 0x01696f, warn: 0xda7101, error: 0xa12c7b };
const LEVEL_EMOJI = { debug: '🟣', info: '🔵', warn: '🟡', error: '🔴' };
const LEVEL_LABEL = { debug: 'DEBUG', info: 'INFO', warn: 'WARN', error: 'ERROR' };

const ALL_LEVELS = ['debug', 'info', 'warn', 'error'];
const KNOWN_TAGS = ['CMD', 'DB', 'SCHEDULER', 'READY', 'HANDLER', 'LICHCODINH', 'BROADCAST', 'EXPORT'];

function fmtIso(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function truncate(s, n = 80) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ─── Build log embed ──────────────────────────────────────────────────────────
function buildLogEmbed(entries, opts = {}) {
  const { level, tag, limit } = opts;
  const color = level ? (LEVEL_COLOR[level] ?? 0x28251d) : 0x006494;

  if (!entries.length) {
    return new EmbedBuilder()
      .setColor(0x7a7974)
      .setTitle('📋 Log — Không có kết quả')
      .setDescription('Không tìm thấy log nào khớp với bộ lọc hiện tại.')
      .setFooter({ text: buildFilterLabel(opts) })
      .setTimestamp();
  }

  // Nhóm theo level, hiển thị dạng code block
  const lines = entries.map(e => {
    const emoji = LEVEL_EMOJI[e.level] ?? '⚪';
    const time  = fmtIso(e.ts);
    const guild = e.guildId ? ` [${e.guildId.slice(-4)}]` : '';
    return `\`${time}\` ${emoji} **[${e.tag}]**${guild} ${truncate(e.msg, 90)}`;
  });

  // Discord embed description max 4096
  const MAX_DESC = 3900;
  let desc = lines.join('\n');
  if (desc.length > MAX_DESC) {
    const cutLines = [];
    let total = 0;
    for (const l of lines.slice().reverse()) {
      if (total + l.length + 1 > MAX_DESC) break;
      cutLines.unshift(l);
      total += l.length + 1;
    }
    desc = `*…bị cắt, hiển thị ${cutLines.length}/${entries.length} dòng gần nhất*\n` + cutLines.join('\n');
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 Log — ${entries.length} dòng`)
    .setDescription(desc)
    .setFooter({ text: buildFilterLabel(opts) })
    .setTimestamp();
}

function buildFilterLabel({ level, tag, limit } = {}) {
  const parts = [];
  if (level) parts.push(`Level: ${LEVEL_LABEL[level]}`);
  if (tag)   parts.push(`Tag: ${tag}`);
  parts.push(`Limit: ${limit ?? 50}`);
  return parts.join(' · ');
}

// ─── Datadog status embed ─────────────────────────────────────────────────────
function buildDDStatusEmbed() {
  const s = logger.ddStatus();
  const statusEmoji = s.enabled ? '🟢' : '🔴';
  return new EmbedBuilder()
    .setColor(s.enabled ? 0x437a22 : 0x7a7974)
    .setTitle(`${statusEmoji} Datadog Status`)
    .addFields(
      { name: '📡 Kết nối', value: s.enabled ? '**Đã bật**' : '**Tắt** (thiếu DD_API_KEY)', inline: true },
      { name: '🌐 Site',    value: `\`${s.site}\``,    inline: true },
      { name: '⚙️ Service', value: `\`${s.service}\``, inline: true },
      { name: '🏷️ Env',    value: `\`${s.env}\``,     inline: true },
      { name: '📬 Queue',   value: `${s.queueSize} logs chờ gửi`, inline: true },
      { name: '🧠 Ring',    value: `${s.ringSize} logs trong bộ nhớ`, inline: true },
    )
    .setFooter({ text: s.enabled ? 'Logs đang được forward sang Datadog' : 'Đặt DD_API_KEY để bật Datadog' })
    .setTimestamp();
}

// ─── Row builders ─────────────────────────────────────────────────────────────
function buildLevelSelectRow(current) {
  const opts = [
    { label: '⚪ Tất cả level', value: 'all', default: !current },
    ...ALL_LEVELS.map(l => ({
      label: `${LEVEL_EMOJI[l]} ${LEVEL_LABEL[l]}`,
      value: l,
      default: current === l,
    })),
  ];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('log_level_select')
      .setPlaceholder('Lọc theo Level…')
      .addOptions(opts),
  );
}

function buildTagSelectRow(currentTag) {
  const opts = [
    { label: '⚪ Tất cả tag', value: 'all', default: !currentTag },
    ...KNOWN_TAGS.map(t => ({
      label: t,
      value: t,
      default: currentTag === t,
    })),
  ];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('log_tag_select')
      .setPlaceholder('Lọc theo Tag…')
      .addOptions(opts),
  );
}

function buildActionRow(limit) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('log_refresh')
      .setLabel('🔄 Làm mới')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('log_limit_up')
      .setLabel('⬆️ +25 dòng')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(limit >= 200),
    new ButtonBuilder()
      .setCustomId('log_limit_down')
      .setLabel('⬇️ −25 dòng')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(limit <= 25),
    new ButtonBuilder()
      .setCustomId('log_dd_status')
      .setLabel('📡 Datadog')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('log_dd_flush')
      .setLabel('📤 Flush DD')
      .setStyle(ButtonStyle.Danger),
  );
}

// ─── Command ──────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('📋 Xem và quản lý log bot — filter level/tag, Datadog status, flush')
    .addStringOption(opt =>
      opt.setName('level')
        .setDescription('Filter theo level (mặc định: tất cả)')
        .setRequired(false)
        .addChoices(
          { name: '⚪ Tất cả',   value: 'all' },
          { name: '🟣 DEBUG',    value: 'debug' },
          { name: '🔵 INFO',     value: 'info' },
          { name: '🟡 WARN',     value: 'warn' },
          { name: '🔴 ERROR',    value: 'error' },
        )
    )
    .addStringOption(opt =>
      opt.setName('tag')
        .setDescription('Filter theo tag (CMD, DB, SCHEDULER…)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('Số dòng hiển thị (mặc định 50, tối đa 200)')
        .setRequired(false)
        .setMinValue(10)
        .setMaxValue(200)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageGuild')) {
      return interaction.reply({
        content: '⛔ Bạn cần quyền **Quản lý Server** để dùng lệnh này.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // State
    let level = interaction.options.getString('level') ?? 'all';
    let tag   = interaction.options.getString('tag') ?? null;
    let limit = interaction.options.getInteger('limit') ?? 50;

    function getEntries() {
      return logger.getRing({
        level:  level === 'all' ? undefined : level,
        tag:    tag   ?? undefined,
        limit,
      });
    }

    function buildComponents() {
      return [
        buildLevelSelectRow(level === 'all' ? null : level),
        buildTagSelectRow(tag),
        buildActionRow(limit),
      ];
    }

    const entries = getEntries();
    const msg = await interaction.editReply({
      embeds: [buildLogEmbed(entries, { level: level === 'all' ? null : level, tag, limit })],
      components: buildComponents(),
    });

    const collector = msg.createMessageComponentCollector({
      time: 10 * 60_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (comp) => {
      await comp.deferUpdate();

      // Level select
      if (comp.customId === 'log_level_select') {
        level = comp.values[0];
      }

      // Tag select
      else if (comp.customId === 'log_tag_select') {
        tag = comp.values[0] === 'all' ? null : comp.values[0];
      }

      // Refresh
      else if (comp.customId === 'log_refresh') {
        // chỉ re-fetch, không đổi filter
      }

      // Limit up / down
      else if (comp.customId === 'log_limit_up')   { limit = Math.min(200, limit + 25); }
      else if (comp.customId === 'log_limit_down')  { limit = Math.max(25,  limit - 25); }

      // Datadog status
      else if (comp.customId === 'log_dd_status') {
        await comp.editReply({
          embeds: [buildDDStatusEmbed()],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('log_back')
                .setLabel('◀ Quay lại Log')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('log_dd_flush')
                .setLabel('📤 Flush ngay')
                .setStyle(ButtonStyle.Danger),
            ),
          ],
        });
        return;
      }

      // Flush Datadog
      else if (comp.customId === 'log_dd_flush') {
        logger.flush();
        const s = logger.ddStatus();
        await comp.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x437a22)
              .setTitle('📤 Đã flush sang Datadog')
              .setDescription(s.enabled
                ? `Đã gửi batch logs sang \`${s.site}\`.\nQueue còn: **${s.queueSize}** logs.`
                : '⚠️ Datadog chưa được bật (thiếu `DD_API_KEY`).')
              .setTimestamp(),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('log_back')
                .setLabel('◀ Quay lại Log')
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
        });
        return;
      }

      // Back to log view
      else if (comp.customId === 'log_back') {
        // fall through to render log
      }

      // Render log với state hiện tại
      const e2 = getEntries();
      await comp.editReply({
        embeds: [buildLogEmbed(e2, { level: level === 'all' ? null : level, tag, limit })],
        components: buildComponents(),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
