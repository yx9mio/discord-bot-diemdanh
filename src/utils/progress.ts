/**
 * Build a visual progress bar string.
 * @param pct 0–100
 * @param len number of blocks (default 10)
 */
export function buildProgressBar(pct: number, len = 10): string {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}
