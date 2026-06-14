'use strict';
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
try {
  GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVuSans');
  GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'DejaVuSans Bold');
} catch (e) {
  // Font registration failed — canvas will use built-in fallback font
}

const FONT  = 'DejaVuSans';
const BOLD  = 'DejaVuSans Bold';
const W     = 800;
const ROW_H = 66;
const PAD   = 24;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const RANK_COLORS = [
  { bg: '#d19900', text: '#fff', gradient: ['#d19900', '#f0d000'], name: 'gold' },       // #1
  { bg: '#7a8a9a', text: '#fff', gradient: ['#7a8a9a', '#b0bec5'], name: 'silver' },      // #2
  { bg: '#cd7f32', text: '#fff', gradient: ['#cd7f32', '#e8a96f'], name: 'bronze' },      // #3
];

const AVATAR_COLORS = [
  '#57f287', '#5865f2', '#f0a500', '#eb459e', '#1abc9c',
  '#9b59b6', '#e91e63', '#00bcd4', '#ff5722', '#8bc34a',
];

function _getInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

function generateRankImage(rows = [], guildName = '', topN = 10) {
  const count = Math.min(rows.length, topN);
  if (!count) {
    const c = createCanvas(400, 200);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `20px ${BOLD}`;
    ctx.textAlign = 'center';
    ctx.fillText('Chua co du lieu xep hang', 200, 110);
    return c.toBuffer('image/png');
  }

  const H = 90 + count * ROW_H + PAD;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.5, '#16213e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#01696f';
  ctx.fillRect(0, 0, W, 4);

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `26px ${BOLD}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Bang xep hang', PAD, 28);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `13px ${FONT}`;
  const now = new Date();
  const ds = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
  ctx.fillText(`${guildName}  |  Cap nhat ${ds}`, PAD, 58);

  const rowY0 = 90;

  for (let i = 0; i < count; i++) {
    const r = rows[i];
    const y = rowY0 + i * ROW_H;
    const isAlt = i % 2 === 0;

    // Row background
    ctx.fillStyle = isAlt ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(PAD, y, W - PAD * 2, ROW_H - 4);

    // Rank badge with gradient
    const rc = RANK_COLORS[i];

    const bx = PAD + 8, by = y + 6;
    const badgeW = 34, badgeH = ROW_H - 16;
    if (rc) {
      const bg = ctx.createLinearGradient(bx, by, bx, by + badgeH);
      bg.addColorStop(0, rc.gradient[0]);
      bg.addColorStop(1, rc.gradient[1]);
      ctx.fillStyle = bg;
    } else {
      ctx.fillStyle = '#4a5568';
    }
    roundRect(ctx, bx, by, badgeW, badgeH, 7);
    ctx.fill();

    ctx.fillStyle = i < 3 ? '#ffffff' : '#1a1a2e';
    ctx.font = `14px ${BOLD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${i + 1}`, bx + 17, by + badgeH / 2);

    // Avatar circle
    const avatarX = bx + badgeW + 14;
    const avatarY = y + 8;
    const avatarR = 22;

    const ac = AVATAR_COLORS[i % AVATAR_COLORS.length];
    ctx.fillStyle = ac;
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.fill();

    // Avatar border glow for top 3
    if (i < 3) {
      ctx.strokeStyle = rc.bg;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Initial letter
    const initial = _getInitial(r.displayName);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 16px ${BOLD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, avatarX + avatarR, avatarY + avatarR);

    // Name
    const nx = avatarX + avatarR * 2 + 14;
    const nm = (r.displayName || `<@${r.user_id}>`).slice(0, 18);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `15px ${BOLD}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(nm, nx, y + 22);

    const phong = (r.phong_ban || '').slice(0, 16);
    if (phong) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `11px ${FONT}`;
      ctx.fillText(phong, nx, y + 46);
    }

    // Stats right
    const joined = r.total_joined || 0;
    const totalS = r.total_sessions || joined;
    const streak = r.current_streak || 0;
    const pct = totalS > 0 ? Math.round(joined / totalS * 100) : 0;
    const statColor = pct >= 80 ? '#57f287' : pct >= 50 ? '#f0a500' : pct >= 25 ? '#ed8936' : '#ff4444';

    const sx = W - PAD - 8;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `14px ${BOLD}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${joined} phien`, sx, y + 18);
    ctx.fillStyle = statColor;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`${pct}%`, sx, y + 40);
    if (streak > 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${streak} lien tiep`, sx - 55, y + 40);
    }

    // Progress bar (below name, wider)
    const bx2 = nx, by2 = y + 34, bw = 280, bh = 8;
    ctx.fillStyle = '#2d3748';
    roundRect(ctx, bx2, by2, bw, bh, 4);
    ctx.fill();

    const filled = Math.round(pct / 100 * bw);
    if (filled > 0) {
      const bg = ctx.createLinearGradient(bx2, 0, bx2 + bw, 0);
      if (pct >= 80) { bg.addColorStop(0, '#57f287'); bg.addColorStop(1, '#38a169'); }
      else if (pct >= 50) { bg.addColorStop(0, '#f0a500'); bg.addColorStop(1, '#d19900'); }
      else if (pct >= 25) { bg.addColorStop(0, '#ed8936'); bg.addColorStop(1, '#c05621'); }
      else { bg.addColorStop(0, '#ff4444'); bg.addColorStop(1, '#c53030'); }
      ctx.fillStyle = bg;
      roundRect(ctx, bx2, by2, filled, bh, 4);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(PAD, y + ROW_H - 3, W - PAD * 2, 1);
  }

  return c.toBuffer('image/png');
}

function generatePieChart(labels = [], values = [], colors = [], title = '') {
  const W2 = 500, H2 = 380;
  const c = createCanvas(W2, H2);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W2, H2);
  ctx.fillStyle = '#01696f';
  ctx.fillRect(0, 0, W2, 4);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `18px ${BOLD}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title || 'Thong ke', PAD, 20);

  const total = values.reduce((a, b) => a + b, 0);
  if (!total) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Chua co du lieu', W2 / 2, H2 / 2);
    return c.toBuffer('image/png');
  }

  // Donut chart
  const cx = 180, cy = 210, radius = 110;
  let startAngle = -Math.PI / 2;
  for (let i = 0; i < labels.length; i++) {
    const angle = (values[i] / total) * Math.PI * 2;
    if (angle === 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i] || '#94a3b8';
    ctx.fill();
    startAngle += angle;
  }

  // Center hole
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `20px ${BOLD}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${total}`, cx, cy - 6);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `11px ${FONT}`;
  ctx.fillText('tong', cx, cy + 14);

  // Legend
  const lx = 320;
  let ly = 110;
  for (let i = 0; i < labels.length; i++) {
    if (values[i] === 0) continue;
    const pct = Math.round(values[i] / total * 100);
    ctx.fillStyle = colors[i] || '#94a3b8';
    ctx.fillRect(lx, ly, 14, 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], lx + 22, ly + 7);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${values[i]} (${pct}%)`, W2 - PAD, ly + 7);
    ly += 30;
  }

  return c.toBuffer('image/png');
}

module.exports = { generateRankImage, generatePieChart };
