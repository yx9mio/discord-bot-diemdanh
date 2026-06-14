import { describe, it, expect } from 'vitest';
import { buildCsvBuffer, buildCsvFilename } from '../utils/csvHelper.js';

describe('buildCsvBuffer', () => {
  it('returns Buffer with BOM + headers + data', () => {
    const headers = ['name', 'age'];
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const buf = buildCsvBuffer(headers, rows);
    const str = buf.toString('utf8');

    expect(str).toContain('name,age');
    expect(str).toContain('Alice,30');
    expect(str).toContain('Bob,25');
    expect(str.startsWith('\uFEFF')).toBe(true);
  });

  it('escapes commas and quotes', () => {
    const headers = ['name', 'note'];
    const rows = [{ name: 'Alice,', note: 'has "quotes"' }];
    const str = buildCsvBuffer(headers, rows).toString('utf8');

    expect(str).toContain('"Alice,"');
    expect(str).toContain('"has ""quotes"""');
  });

  it('handles null/undefined values', () => {
    const headers = ['a', 'b'];
    const rows = [{ a: null, b: undefined }];
    const str = buildCsvBuffer(headers, rows).toString('utf8');

    expect(str).toContain(',');
  });

  it('returns empty string for missing fields', () => {
    const headers = ['a', 'b', 'c'];
    const rows = [{ a: 'x' }];
    const str = buildCsvBuffer(headers, rows).toString('utf8');

    expect(str).toContain('x,,');
  });
});

describe('buildCsvFilename', () => {
  it('returns filename with prefix and date', () => {
    const name = buildCsvFilename('test');
    expect(name).toMatch(/^test_\d{8}_\d{4}\.csv$/);
  });

  it('uses custom extension', () => {
    const name = buildCsvFilename('x', 'tsv');
    expect(name).toMatch(/\.tsv$/);
  });

  it('defaults to csv extension', () => {
    const name = buildCsvFilename('data');
    expect(name).toMatch(/\.csv$/);
  });
});
