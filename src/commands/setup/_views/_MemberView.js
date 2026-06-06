'use strict';
// _MemberView.js — Redesign: Select menu per-page + Search + Bulk import
// Fix: hiển thị đúng tất cả thành viên trong trang (không giới hạn cứng 5)
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');
const memberService = require('../../../services/memberService.js');

const CUSTOM_ID = {
  ADD:           'setup:mem:add',
  BULK_IMPORT:   'setup:mem:bulk',
  SEARCH:        'setup:mem:search',
  SEARCH_CLEAR:  'setup:mem:search:clear',
  PAGE_NEXT:     'setup:mem:page:next',
  PAGE_PREV:     'setup:mem:page:prev',
  DEL_PREFIX:    'setup:mem:del:',
  EDIT_PREFIX:   'setup:mem:edit:',
  RESET_PREFIX:  'setup:mem:reset:',
  SELECT_ACTION: 'setup:mem:action:select',
  REFRESH:       'setup:mem:refresh',
  BACK_HOME:     'setup:home',
};

const PAGE_SIZE = 8; // giảm xuống 8 để tránh tràn embed

/**
 * render({ members, page, guild, query })
 * - members: toàn bộ danh sách từ DB
 * - page: trang hiện tại (0-indexed)
 * - guild: Guild object
 * - query: chuỗi tìm kiếm (optional)
 */
function render({ members, page = 0, guild, query = '' }) {
  // Filter theo query nếu có
  const filtered = query
    ? members.filter(m =>
        (m.username ?? '').toLowerCase().includes(query.toLowerCase()) ||
        m.user_id.includes(query) ||
        (m.phong_ban ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : members;

  const total = filtered.length;
  const totalAll = members.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  // ── Embed ──────────────────────────────────────────────────────────────────
  const titleSuffix = query ? ` · 🔍 "${query.slice(0, 20)}"` : '';
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.MEMBER} Thành viên — ${guild.name}${titleSuffix}`)
    .setDescription(
      total === 0
        ? (query
            ? `*Không tìm thấy thành viên nào khớp với "${query}".*\n> Nhấn **Xóa tìm kiếm** để quay lại danh sách đầy đủ.`
            : `*Chưa có thành viên nào.*\n> Bấm **${ICONS.PLUS} Thêm** để bắt đầu.`
          )
        : slice.map((m, i) => {
            const phong = m.phong_ban ? ` \`${m.phong_ban}\`` : '';
            const note  = m.ghi_chu  ? ` · 📝 _${m.ghi_chu}_` : '';
            return `\`${start + i + 1}.\` <@${m.user_id}>${phong}${note}`;
          }).join('\n')
    )
    .setFooter({
      text: [
        FOOTER_DEFAULT,
        query ? `Kết quả ${total}/${totalAll}` : `Tổng ${totalAll} thành viên`,
        `Trang ${clampedPage + 1}/${totalPages}`,
      ].join(' · '),
    })
    .setTimestamp();

  const components = [];

  // ── Row 1: Select menu chọn thành viên để thao tác ────────────────────────
  if (slice.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(CUSTOM_ID.SELECT_ACTION)
      .setPlaceholder('👆 Chọn thành viên để Sửa / Xóa / Reset streak...')
      .addOptions(
        slice.map(m => {
          const label = (m.username ?? m.user_id).slice(0, 25);
          const desc  = [m.phong_ban, m.ghi_chu].filter(Boolean).join(' · ').slice(0, 50) || m.user_id;
          return new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(m.user_id)
            .setDescription(desc);
        })
      );
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  // ── Row 2: Thêm / Bulk import / Search / Clear search ─────────────────────
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.ADD)
      .setLabel('Thêm')
      .setEmoji(ICONS.PLUS)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BULK_IMPORT)
      .setLabel('Import nhiều')
      .setEmoji('📥')
      .setStyle(ButtonStyle.Primary),
  );
  if (query) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.SEARCH_CLEAR)
        .setLabel('✖ Xóa tìm kiếm')
        .setStyle(ButtonStyle.Danger),
    );
  } else {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.SEARCH)
        .setLabel('Tìm kiếm')
        .setEmoji('🔍')
        .setStyle(ButtonStyle.Secondary),
    );
  }
  components.push(actionRow);

  // ── Row 3: Reset All + Nav ─────────────────────────────────────────────────
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_PREV)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_NEXT)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.REFRESH)
      .setLabel('Làm mới')
      .setEmoji(ICONS.REFRESH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:mem:reset:all')
      .setLabel('Reset all streak')
      .setEmoji('⚠️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );
  components.push(navRow);

  return { embeds: [embed], components, _page: clampedPage, _totalPages: totalPages, _query: query };
}

async function handleRefresh(interaction, page = 0, query = '') {
  await interaction.deferUpdate();
  const members = await memberService.getMembers(interaction.guild.id);
  return interaction.editReply(render({ members, page, guild: interaction.guild, query }));
}

module.exports = { MemberView: { render, handleRefresh, CUSTOM_ID, PAGE_SIZE } };
