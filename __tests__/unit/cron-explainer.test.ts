import { describe, it, expect } from 'vitest';
import { explain, nextRuns, describeField, expandField } from '../../src/tool/cron-logic';
import { cronExplainerTool } from '../../src/tool/tool-definition';
import { notepadTool } from '../../src/tool/notepad-state';
import { initialState } from '../../src/tool/types';

// Deterministic "now" so next-run assertions are stable.
// Fri 2026-01-02 10:00:00 local
const BASE = new Date(2026, 0, 2, 10, 0, 0, 0);

describe('explain — 5-field expressions', () => {
  it('parses and explains a standard 5-field expression', () => {
    const res = explain('30 9 * * 1-5');
    expect(res.error).toBeNull();
    expect(res.fields).toHaveLength(5);
    expect(res.fields[0]).toMatchObject({ name: 'Minute', raw: '30', valid: true });
    expect(res.fields[1]).toMatchObject({ name: 'Hour', raw: '9', valid: true });
    expect(res.fields[2]).toMatchObject({ name: 'Day of month', raw: '*', valid: true });
    expect(res.fields[3]).toMatchObject({ name: 'Month', raw: '*', valid: true });
    expect(res.fields[4]).toMatchObject({ name: 'Day of week', raw: '1-5', valid: true });
    expect(res.summary).toContain('09:30');
    expect(res.summary).toContain('weekdays');
  });

  it('explains every-minute expression', () => {
    const res = explain('* * * * *');
    expect(res.error).toBeNull();
    expect(res.fields[0]!.description).toContain('every minute');
    expect(res.summary).toContain('every hour');
  });

  it('explains step values', () => {
    const res = explain('*/15 * * * *');
    expect(res.error).toBeNull();
    expect(res.fields[0]!.description).toContain('every 15 minutes');
  });

  it('explains lists and named months/days', () => {
    const res = explain('0 0 1 JAN *,FRI');
    expect(res.error).toBeNull();
    expect(res.fields[3]!.description).toContain('January');
  });

  it('resolves aliases', () => {
    const res = explain('@daily');
    expect(res.error).toBeNull();
    expect(res.fields.map((f) => f.raw)).toEqual(['0', '0', '*', '*', '*']);
    expect(res.summary).toContain('00:00');
  });

  it('explains L, W and # special characters', () => {
    const l = explain('0 0 L * *');
    expect(l.error).toBeNull();
    expect(l.fields[2]!.description).toContain('last day');

    const w = explain('0 0 15W * *');
    expect(w.error).toBeNull();
    expect(w.fields[2]!.description).toContain('weekday');

    const nth = explain('0 12 ? * 5#2');
    expect(nth.error).toBeNull();
    expect(nth.fields[4]!.description).toContain('2nd Friday');

    const lastFri = explain('0 12 * * 5L');
    expect(lastFri.error).toBeNull();
    expect(lastFri.fields[4]!.description).toContain('last Friday');
  });

  it('handles 6-field expressions with seconds', () => {
    const res = explain('0 30 9 * * *');
    expect(res.error).toBeNull();
    expect(res.fields).toHaveLength(6);
    expect(res.fields[0]!.name).toBe('Minute'); // seconds field reuse
  });

  it('rejects wrong field count', () => {
    const res = explain('30 9 * *');
    expect(res.error).toMatch(/5 fields|6 fields|Found 3/i);
  });

  it('rejects unknown alias', () => {
    const res = explain('@sometimes');
    expect(res.error).toContain('Unknown alias');
  });

  it('rejects out-of-range values', () => {
    const res = explain('90 9 * * *');
    expect(res.error).toContain('Invalid');
  });

  it('returns no error for empty input', () => {
    expect(explain('').error).toBeNull();
  });
});

describe('nextRuns — daily expression', () => {
  it('computes correct upcoming dates for a daily expression', () => {
    const { dates, error } = nextRuns('30 9 * * *', BASE, 5);
    expect(error).toBeNull();
    expect(dates).toHaveLength(5);
    // BASE is 10:00 on Jan 2 — the 09:30 run for Jan 2 passed, so first run is Jan 3.
    expect(dates[0]!.getDate()).toBe(3);
    expect(dates[0]!.getMonth()).toBe(0);
    expect(dates[0]!.getHours()).toBe(9);
    expect(dates[0]!.getMinutes()).toBe(30);
    expect(dates.map((d) => d.getDate())).toEqual([3, 4, 5, 6, 7]);
  });

  it('computes next run strictly after now for every-minute', () => {
    const { dates } = nextRuns('* * * * *', BASE, 3);
    expect(dates[0]!.getTime()).toBe(BASE.getTime() + 60_000);
    expect(dates[1]!.getTime()).toBe(BASE.getTime() + 120_000);
  });

  it('produces runs every hour on the half hour', () => {
    const { dates } = nextRuns('30 * * * *', BASE, 2);
    expect(dates[0]!.getMinutes()).toBe(30);
    expect(dates[0]!.getHours()).toBe(10);
    expect(dates[1]!.getHours()).toBe(11);
  });

  it('honors weekday restrictions', () => {
    // Jan 2 2026 is a Friday. Next Monday is Jan 5.
    const { dates } = nextRuns('0 9 * * 1', BASE, 2);
    expect(dates[0]!.getDay()).toBe(1);
    expect(dates[0]!.getDate()).toBe(5);
  });

  it('skips months outside list', () => {
    const { dates } = nextRuns('0 0 1 1,3 *', BASE, 2);
    expect(dates[0]!.getMonth()).toBe(2); // March
    expect(dates[0]!.getDate()).toBe(1);
    expect(dates[1]!.getMonth()).toBe(0); // next occurrence: Jan 1 2027
    expect(dates[1]!.getFullYear()).toBe(2027);
  });

  it('handles step hours', () => {
    const { dates } = nextRuns('0 */6 * * *', BASE, 2);
    expect(dates[0]!.getHours()).toBe(12);
    expect(dates[1]!.getHours()).toBe(18);
  });

  it('supports L (last day of month)', () => {
    // January has 31 days — next L run after Jan 2 is Jan 31.
    const { dates } = nextRuns('0 0 L * *', BASE, 2);
    expect(dates[0]!.getDate()).toBe(31);
    expect(dates[0]!.getMonth()).toBe(0);
    // February 2026 has 28 days.
    expect(dates[1]!.getMonth()).toBe(1);
    expect(dates[1]!.getDate()).toBe(28);
  });

  it('returns error for invalid input instead of crashing', () => {
    const { dates, error } = nextRuns('not a cron', BASE, 5);
    expect(dates).toHaveLength(0);
    expect(error).not.toBeNull();
  });
});

describe('expandField', () => {
  it('expands stars, steps, ranges and lists', () => {
    expect(expandField('*', 0, 2, 0)).toEqual([0, 1, 2]);
    expect(expandField('*/2', 0, 5, 0)).toEqual([0, 2, 4]);
    expect(expandField('1-3', 0, 5, 0)).toEqual([1, 2, 3]);
    expect(expandField('1,3,5', 0, 5, 0)).toEqual([1, 3, 5]);
    expect(expandField('2-8/3', 1, 12, 0)).toEqual([2, 5, 8]);
  });
});

describe('describeField', () => {
  it('describes ranges and lists', () => {
    expect(describeField({ name: 'Hour', min: 0, max: 23 }, '9-17')).toContain('9');
  });
});

describe('tool state serialize/deserialize', () => {
  it('round-trips valid state', () => {
    const state = { expression: '*/5 * * * *', error: null };
    const serialized = cronExplainerTool.serialize(state);
    const res = cronExplainerTool.deserialize(JSON.parse(serialized));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toEqual(state);
  });

  it('deserializes through the notepad alias', () => {
    const res = notepadTool.deserialize({ expression: '@daily', error: null });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.expression).toBe('@daily');
  });

  it('rejects invalid payloads', () => {
    expect(cronExplainerTool.deserialize(null).success).toBe(false);
    expect(cronExplainerTool.deserialize({}).success).toBe(false);
    expect(notepadTool.deserialize('nope').success).toBe(false);
  });

  it('has a sensible initial state', () => {
    expect(initialState.expression).toBeTruthy();
    expect(initialState.error).toBeNull();
  });
});
