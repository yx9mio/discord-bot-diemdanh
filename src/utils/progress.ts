export function buildProgressBar(value: number, total: number, size = 12): string {
  if (total <= 0) return '░'.repeat(size) + ' 0%';
  const ratio = Math.max(0, Math.min(1, value / total));
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)} ${Math.round(ratio * 100)}%`;
}
