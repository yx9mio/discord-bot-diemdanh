import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wizardDraft from '../utils/wizardDraft.js';
import { renderStep2, renderStep3, BTN_NEXT, BTN_CONFIRM } from '../utils/_views/wizardView.js';

function makeCache(arr) {
  return {
    ...arr.reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {}),
    filter(fn) { return { ...this, ...Object.values(this).filter(v => v && v.id !== undefined && fn(v)) }; },
    sort(fn) { return { ...this, ...Object.values(this).filter(v => v && v.id !== undefined).sort(fn) }; },
    first(n) { return Object.values(this).filter(v => v && v.id !== undefined).slice(0, n); },
    get(k) { return this[k] ?? null; },
  };
}

const guild = {
  channels: { cache: makeCache([
    ['c1', { id: 'c1', name: 'bang-chien', type: 0, position: 1 }],
    ['c2', { id: 'c2', name: 'thong-bao', type: 0, position: 0 }],
  ]) },
  roles: { cache: makeCache([
    ['r1', { id: 'r1', name: 'Members', position: 5 }],
    ['r2', { id: 'r2', name: 'Admin', position: 10 }],
  ]) },
  id: 'g1',
};

describe('wizardDraft — [UX-W3]', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    wizardDraft.clear('u1');
  });

  it('stores and retrieves draft per user', () => {
    wizardDraft.put('u1', { ten: 'Kỳ 1', channelId: null });
    expect(wizardDraft.get('u1').ten).toBe('Kỳ 1');
    expect(wizardDraft.get('other')).toBeNull();
  });

  it('expires after 10 minutes', () => {
    wizardDraft.put('u1', { ten: 'Kỳ 1' });
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(wizardDraft.get('u1')).toBeNull();
  });

  it('clear removes draft', () => {
    wizardDraft.put('u1', { ten: 'Kỳ 1' });
    wizardDraft.clear('u1');
    expect(wizardDraft.get('u1')).toBeNull();
  });
});

describe('renderStep2 — [UX-W3] chọn kênh + role', () => {
  it('returns 3 rows: channel select, role select, nav buttons', () => {
    const { embeds, components } = renderStep2({ guild, draft: { ten: 'Kỳ', moTa: '', phut: 30, channelId: null, roleId: null } });
    expect(embeds).toHaveLength(1);
    expect(embeds[0].toJSON().title).toBe('⚔️ Tạo Bang Chiến — Bước 2/3');
    expect(components).toHaveLength(3);
    expect(components[0].toJSON().components[0].type).toBe(3); // StringSelect
  });

  it('Tiếp theo disabled until channel chosen', () => {
    const noCh = renderStep2({ guild, draft: { ten: 'Kỳ', moTa: '', phut: null, channelId: null, roleId: null } });
    const next1 = noCh.components[2].toJSON().components.find(b => b.custom_id === BTN_NEXT);
    expect(next1.disabled).toBe(true);

    const withCh = renderStep2({ guild, draft: { ten: 'Kỳ', moTa: '', phut: null, channelId: 'c2', roleId: null } });
    const next2 = withCh.components[2].toJSON().components.find(b => b.custom_id === BTN_NEXT);
    expect(next2.disabled).toBeFalsy();
  });

  it('marks chosen channel and role as default', () => {
    const { components } = renderStep2({ guild, draft: { ten: 'Kỳ', moTa: '', phut: 10, channelId: 'c2', roleId: 'r1' } });
    const chOpts = components[0].toJSON().components[0].options;
    expect(chOpts.find(o => o.value === 'c2').default).toBe(true);
    const roleOpts = components[1].toJSON().components[0].options;
    expect(roleOpts.find(o => o.value === 'r1').default).toBe(true);
    expect(roleOpts.find(o => o.value === 'none').default).toBe(false);
  });
});

describe('renderStep3 — [UX-W3] tóm tắt + xác nhận', () => {
  it('shows confirm/back/cancel buttons', () => {
    const { embeds, components } = renderStep3({ guild, draft: { ten: 'Kỳ', moTa: '', phut: 30, channelId: 'c2', roleId: 'r1' } });
    expect(embeds[0].toJSON().title).toBe('⚔️ Tạo Bang Chiến — Bước 3/3');
    const ids = components[0].toJSON().components.map(b => b.custom_id);
    expect(ids).toContain(BTN_CONFIRM);
    expect(ids).toContain('setup:wizard:back');
    expect(ids).toContain('setup:wizard:cancel');
  });
});