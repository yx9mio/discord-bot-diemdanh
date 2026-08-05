import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const SCAN_GLOBS = ['services/*.js', 'utils/*.js'];

function readMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf8') }));
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function buildSchema(migrations) {
  const tables = {};
  const functions = new Set();

  for (const { sql } of migrations) {
    const body = sql.replace(/--[^\n]*/g, '').replace(/\$\$[\s\S]*?\$\$/g, '$$$$');

    for (const m of body.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\)\s*;/gi)) {
      const name = m[1];
      if (!tables[name]) tables[name] = { columns: {}, pk: [] };
      for (const part of splitTopLevel(m[2])) {
        const pk = part.match(/^PRIMARY\s+KEY\s*\(([^)]*)\)/i);
        if (pk) {
          tables[name].pk = pk[1].split(',').map((s) => s.trim());
          continue;
        }
        const col = part.match(/^(\w+)\s+(\w[\w[]*)/);
        if (col) {
          const [, cname, ctype] = col;
          tables[name].columns[cname] = ctype.toLowerCase();
          if (part.toLowerCase().includes('primary key')) {
            tables[name].pk = [cname];
          }
        }
      }
    }

    for (const m of body.matchAll(/ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)\s+([\w[\]]+)/gi)) {
      const [, table, col, type] = m;
      if (!tables[table]) tables[table] = { columns: {}, pk: [] };
      tables[table].columns[col] = type.toLowerCase();
    }

    for (const m of body.matchAll(/ALTER TABLE\s+(\w+)\s+ALTER COLUMN\s+(\w+)\s+TYPE\s+(\w+)/gi)) {
      const [, table, col, type] = m;
      if (tables[table] && tables[table].columns[col]) {
        tables[table].columns[col] = type.toLowerCase();
      }
    }

    for (const m of body.matchAll(/ALTER TABLE\s+(\w+)\s+DROP COLUMN\s+(?:IF EXISTS\s+)?(\w+)/gi)) {
      const [, table, col] = m;
      if (tables[table]) delete tables[table].columns[col];
    }

    for (const m of body.matchAll(/DROP TABLE IF EXISTS\s+(\w+)/gi)) {
      delete tables[m[1]];
    }

    for (const m of body.matchAll(/CREATE OR REPLACE FUNCTION\s+(\w+)/gi)) {
      functions.add(m[1]);
    }
  }

  return { tables, functions };
}

function collectCodeRefs() {
  const refs = { tables: new Set(), columns: {}, rpcs: new Set() };
  const files = [];
  for (const glob of SCAN_GLOBS) {
    const [dir, pattern] = glob.split('/');
    const absDir = join(ROOT, dir);
    if (!statSync(absDir, { throwIfNoEntry: false })) continue;
    for (const f of readdirSync(absDir)) {
      if (!f.endsWith('.js')) continue;
      if (pattern === '*.js') files.push(join(absDir, f));
    }
  }
  files.sort();

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)) {
      const table = m[1];
      refs.tables.add(table);
      if (!refs.columns[table]) refs.columns[table] = new Set();
      const chunk = src.slice(m.index, src.indexOf('.from(', m.index + 1) === -1 ? src.length : src.indexOf('.from(', m.index + 1));

      for (const c of chunk.matchAll(/\.(?:eq|in|lte|gte|lt|gt|contains|not|order|ilike|is)\('([\w]+)'/g)) {
        refs.columns[table].add(c[1]);
      }
      for (const c of chunk.matchAll(/\.select\(\s*['"]([^'"]+)['"]/g)) {
        const select = c[1];
        for (const j of select.matchAll(/([a-z_]+)![a-z_]+\(([^)]*)\)/g)) {
          const joined = j[1];
          refs.tables.add(joined);
          if (!refs.columns[joined]) refs.columns[joined] = new Set();
          for (const col of j[2].split(',')) {
            const colName = col.trim();
            if (colName && colName !== '*') refs.columns[joined].add(colName);
          }
        }
        const plain = select.replace(/[a-z_]+![a-z_]+\([^)]*\)/g, '');
        for (const tok of plain.split(',')) {
          const t = tok.trim();
          if (t && t !== '*') refs.columns[table].add(t);
        }
      }
      for (const c of chunk.matchAll(/onConflict\s*:\s*['"]([^'"]+)['"]/g)) {
        for (const col of c[1].split(',')) refs.columns[table].add(col.trim());
      }
    }

    for (const r of src.matchAll(/\.rpc\(\s*['"]([a-z_]+)['"]/g)) {
      refs.rpcs.add(r[1]);
    }
  }
  return refs;
}

const schema = buildSchema(readMigrations());
const codeRefs = collectCodeRefs();

describe('schema migration coverage', () => {
  it('has a schema for every table referenced by code', () => {
    const missing = [...codeRefs.tables].filter((t) => !schema.tables[t]);
    expect(missing).toEqual([]);
  });

  it('has every column referenced by code', () => {
    const missing = [];
    for (const [table, cols] of Object.entries(codeRefs.columns)) {
      const t = schema.tables[table];
      if (!t) continue;
      for (const col of cols) {
        if (!(col in t.columns)) missing.push(`${table}.${col}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has every RPC function referenced by code', () => {
    const missing = [...codeRefs.rpcs].filter((f) => !schema.functions.has(f));
    expect(missing).toEqual([]);
  });
});

describe('attendance_locks', () => {
  const t = schema.tables.attendance_locks;

  it('exists', () => {
    expect(t).toBeDefined();
  });

  it('has composite primary key (session_id, user_id)', () => {
    expect(t.pk).toEqual(['session_id', 'user_id']);
  });

  it('has uuid session_id (not bigint)', () => {
    expect(t.columns.session_id).toBe('uuid');
  });

  it('has text user_id (not bigint)', () => {
    expect(t.columns.user_id).toBe('text');
  });

  it('has created_at timestamptz', () => {
    expect(t.columns.created_at).toBe('timestamptz');
  });
});

describe('core tables', () => {
  it('sessions has expected columns', () => {
    const t = schema.tables.sessions;
    expect(t).toBeDefined();
    expect(t.columns.id).toBe('uuid');
    expect(t.columns.guild_id).toBe('text');
    expect(t.columns.is_active).toBe('boolean');
    expect(t.columns.cancelled).toBe('boolean');
    expect(t.columns.phai_role_ids).toBe('text[]');
    expect(t.columns.started_at).toBe('timestamptz');
  });

  it('attendances has expected columns', () => {
    const t = schema.tables.attendances;
    expect(t).toBeDefined();
    expect(t.columns.session_id).toBe('uuid');
    expect(t.columns.user_id).toBe('text');
    expect(t.columns.status).toBe('text');
    expect(t.columns.checked_in_at).toBe('timestamptz');
  });

  it('scheduler_locks exists with text primary key', () => {
    const t = schema.tables.scheduler_locks;
    expect(t).toBeDefined();
    expect(t.pk).toEqual(['job_name']);
    expect(t.columns.instance_id).toBe('text');
    expect(t.columns.locked_until).toBe('timestamptz');
  });

  it('audit_logs exists', () => {
    const t = schema.tables.audit_logs;
    expect(t).toBeDefined();
    expect(t.columns.actor_id).toBe('text');
    expect(t.columns.metadata).toBe('jsonb');
  });
});
