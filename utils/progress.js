function buildProgressBar(pct, len = 10) {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}
module.exports = { buildProgressBar };
