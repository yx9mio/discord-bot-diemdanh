/**
 * Builds a visual progress bar string.
 * @param current - Number of participants who joined
 * @param total - Total eligible participants
 * @param length - Bar length in characters (default 10)
 */
export function buildProgressBar(current: number, total: number, length = 10): string {
  if (total <= 0) return `\`[${'░'.repeat(length)}]\` 0%`;
  const ratio = Math.min(current / total, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const pct = Math.round(ratio * 100);
  return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` ${pct}% (${current}/${total})`;
}
