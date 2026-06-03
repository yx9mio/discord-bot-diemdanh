// tests/unit/commandsContract.test.js
// Commit 6: chỉ còn 6 commands. Categories giảm xuống 3 (PHIEN, DIEM_DANH, TIEN_ICH).
// [C1] Thêm /admin dashboard → 7 commands (4 user, 3 admin).

import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const { byAudience, byCategory, CATEGORIES } = await import('../../utils/commands.js');

function findCmdFiles(dir) {
  let out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out = out.concat(findCmdFiles(p));
    else if (f.endsWith('.js') && !f.endsWith('View.js')) out.push(p);
  }
  return out;
}

function fileToCmdName(filename) {
  return filename
    .replace(/Command$/, '')
    .replace(/\.js$/, '');
}

describe('Commands contract', () => {
  it('mọi file trong src/commands/ đều có entry trong registry', () => {
    const files = findCmdFiles('src/commands').map(f => basename(f, '.js'));
    const registryNames = [
      ...byAudience('user'),
      ...byAudience('admin'),
    ].map(c => c.name);
    const mapped = files.map(fileToCmdName);
    const missing = mapped.filter(name => !registryNames.includes(name));
    expect(missing, `Missing registry entries: ${missing.join(', ')}`).toEqual([]);
  });

  it('mọi entry trong registry đều có file tương ứng', () => {
    const files = findCmdFiles('src/commands').map(f => basename(f, '.js'));
    const registryNames = [
      ...byAudience('user'),
      ...byAudience('admin'),
    ].map(c => c.name);
    const fileSet = new Set(files);
    const missing = registryNames.filter(name => {
      return !fileSet.has(name) && !fileSet.has(`${name}Command`);
    });
    expect(missing, `Missing files: ${missing.join(', ')}`).toEqual([]);
  });

  it('3 user commands và 4 admin commands (Commit 6 + C1)', () => {
    expect(byAudience('user')).toHaveLength(3);
    expect(byAudience('admin')).toHaveLength(4);
  });

  it('mỗi category trong CATEGORIES đều có ≥1 command', () => {
    for (const cat of Object.keys(CATEGORIES)) {
      expect(byCategory(cat).length, `${cat} phải có ≥1 command`).toBeGreaterThan(0);
    }
  });
});
