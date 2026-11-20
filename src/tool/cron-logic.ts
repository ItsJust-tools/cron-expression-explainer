import {
  ALIASES,
  DAY_NAMES,
  MONTH_NAMES,
  type CronFieldExplanation,
  type ToolState,
} from './types';

const STEPS_RE = /^\*\/(\d+)$/;
const RANGE_RE = /^(\d+)-(\d+)$/;
const RANGE_STEP_RE = /^(\d+)-(\d+)\/(\d+)$/;
const LIST_RE = /^[0-9a-zA-Z*?,-/]+$/;

interface FieldSpec {
  name: string;
  min: number;
  max: number;
  names?: string[];
  nameOffset?: number; // offset applied when parsing names
}

const FIELD_SPECS: FieldSpec[] = [
  { name: 'Minute', min: 0, max: 59 },
  { name: 'Hour', min: 0, max: 23 },
  { name: 'Day of month', min: 1, max: 31 },
  { name: 'Month', min: 1, max: 12, names: MONTH_NAMES },
  { name: 'Day of week', min: 0, max: 7, names: DAY_NAMES, nameOffset: 7 },
];

function resolveToken(token: string, spec: FieldSpec): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  if (spec.names) {
    const offset = spec.nameOffset ?? 0;
    const lower = token.slice(0, 3).toLowerCase();
    const idx = spec.names.findIndex((n, i) => n.toLowerCase().slice(0, 3) === lower);
    if (idx >= 0 && offset === 7) return idx === 0 ? 7 : idx; // weekday: SUN=0/7
    if (idx >= 0) return idx + 1; // month: JAN=1
  }
  return null;
}

function describeSetField(spec: FieldSpec, raw: string): string {
  if (raw === '*') return `every ${spec.name.toLowerCase()}`;
  if (raw === '?') return `any ${spec.name.toLowerCase()} (no specific value)`;
  const steps = raw.match(STEPS_RE);
  if (steps)
    return `every ${steps[1]} ${spec.name.toLowerCase()}${parseInt(steps[1]!, 10) > 1 ? 's' : ''}`;
  const rangeStep = raw.match(RANGE_STEP_RE);
  if (rangeStep) {
    return `${fmt(spec, parseInt(rangeStep[1]!, 10))} through ${fmt(spec, parseInt(rangeStep[2]!, 10))}, every ${rangeStep[3]} ${spec.name.toLowerCase()}${parseInt(rangeStep[3]!, 10) > 1 ? 's' : ''}`;
  }
  const range = raw.match(RANGE_RE);
  if (range) {
    return `${fmt(spec, parseInt(range[1]!, 10))} through ${fmt(spec, parseInt(range[2]!, 10))}`;
  }
  // list
  const parts = raw.split(',');
  return `at ${spec.name.toLowerCase()} ${parts.map((p) => fmtToken(spec, p as string)).join(', ')}`;
}

function fmtToken(spec: FieldSpec, token: string): string {
  const v = resolveToken(token, spec);
  if (v !== null) return fmt(spec, v);
  if (/^\*\/\d+$/.test(token)) return token;
  return token;
}

function fmt(spec: FieldSpec, v: number): string {
  if (spec.names) {
    // Month values are 1-12 (JAN=1); weekday values are 0-7 (SUN=0 or 7).
    if (spec.min === 1) return (spec.names as readonly string[])[v - 1] as string;
    return (spec.names as readonly string[])[v % spec.names.length] as string;
  }
  return String(v);
}

export function describeField(spec: FieldSpec, raw: string): string {
  return describeSetField(spec, raw);
}

/** Last day-of-month ('L') or nearest-weekday ('L' / 'W') handling for day field. */
function describeDayOfMonth(raw: string): CronFieldExplanation {
  const spec = FIELD_SPECS[2] as FieldSpec;
  if (raw === 'L') {
    return { name: 'Day of month', raw, description: 'on the last day of the month', valid: true };
  }
  const wl = raw.match(/^LW$/i);
  if (wl) {
    return {
      name: 'Day of month',
      raw,
      description: 'on the last weekday (Mon–Fri) of the month',
      valid: true,
    };
  }
  const w = raw.match(/^(\d+)W$/i);
  if (w) {
    return {
      name: 'Day of month',
      raw,
      description: `on the weekday (Mon–Fri) nearest to day ${w[1]} of the month`,
      valid: true,
    };
  }
  const l = raw.match(/^L-(\d+)$/);
  if (l) {
    return {
      name: 'Day of month',
      raw,
      description: `${l[1]} day(ies) before the last day of the month`,
      valid: true,
    };
  }
  const lastX = raw.match(/^(\d+)L$/i);
  if (lastX) {
    return {
      name: 'Day of month',
      raw,
      description: `on the last ${DAY_NAMES[parseInt(lastX[1]!, 10) % 7]} of the month`,
      valid: true,
    };
  }
  return plainField(spec, raw);
}

function describeDayOfWeek(raw: string): CronFieldExplanation {
  const spec = FIELD_SPECS[4] as FieldSpec;
  const nth = raw.match(/^(\d+)#(\d+)$/i);
  if (nth) {
    const dayIdx = parseInt(nth[1]!, 10) % 7;
    return {
      name: 'Day of week',
      raw,
      description: `on the ${ordinal(parseInt(nth[2]!, 10))} ${DAY_NAMES[dayIdx]} of the month`,
      valid: true,
    };
  }
  const lastX = raw.match(/^(\d+)L$/i);
  if (lastX) {
    return {
      name: 'Day of week',
      raw,
      description: `on the last ${DAY_NAMES[parseInt(lastX[1]!, 10) % 7]} of the month`,
      valid: true,
    };
  }
  return plainField(spec, raw);
}

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return String(n) + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0] ?? 'th');
}

function plainField(spec: FieldSpec, raw: string): CronFieldExplanation {
  if (!LIST_RE.test(raw)) {
    return { name: spec.name, raw, description: '', valid: false };
  }
  // Validate each numeric token against range
  const tokens = raw.split(/[,/]/).filter(Boolean);
  for (const t of tokens) {
    const m = t.match(RANGE_RE);
    const num = m ? m[2] : t;
    const v = resolveToken(num as string, spec);
    if (v === null) continue;
    const rm = t.match(RANGE_RE);
    const lo = rm ? parseInt(rm[1]!, 10) : v;
    if (lo < spec.min || v > spec.max || lo > v) {
      return { name: spec.name, raw, description: '', valid: false };
    }
  }
  if (raw === '*' && spec.name === 'Day of week') {
    return { name: spec.name, raw, description: 'every day of the week', valid: true };
  }
  return { name: spec.name, raw, description: describeSetField(spec, raw), valid: true };
}

export interface FieldsResult {
  fields: CronFieldExplanation[];
  summary: string;
  error: string | null;
}

export function breakDownFieldRaw(raw: string, index: number): CronFieldExplanation {
  const spec: FieldSpec | undefined = FIELD_SPECS[index];
  if (!spec) return { name: `Field ${index}`, raw, description: '', valid: false };
  if (index === 2) return describeDayOfMonth(raw);
  if (index === 4) return describeDayOfWeek(raw);
  return plainField(spec, raw);
}

function timeSummary(min: number, hour: number): string {
  const mm = String(min).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  return `${hh}:${mm}`;
}

function daySummary(dow: CronFieldExplanation, dom: CronFieldExplanation): string | null {
  if (dom.raw === '*' || dom.raw === '?') {
    if (dow.raw === '*' || dow.raw === '?') return 'every day';
    if (dow.raw === '1-5') return 'on weekdays (Mon–Fri)';
    return `on the schedule's day-of-week rule (${dow.raw})`;
  }
  return null;
}

function buildSummary(
  minF: CronFieldExplanation,
  hourF: CronFieldExplanation,
  dom: CronFieldExplanation,
  dow: CronFieldExplanation
): string {
  if (
    minF.raw === '*' ||
    /^\*\/\d+$/.test(minF.raw) ||
    minF.raw.includes(',') ||
    minF.raw.includes('-')
  ) {
    return `Runs every hour, ${minF.description}`;
  }
  const m = parseInt(minF.raw.split(',')[0]!, 10);
  let h: number | null = null;
  if (/^\d+$/.test(hourF.raw)) h = parseInt(hourF.raw, 10);
  if (h !== null && !Number.isNaN(m)) {
    const dayPart = daySummary(dow, dom);
    if (dayPart) return `Runs ${dayPart} at ${timeSummary(m, h)}`;
    return `Runs at ${timeSummary(m, h)} when the day-of-month/day-of-week rules are met`;
  }
  if (hourF.raw === '*') return `Runs every hour at minute ${minF.raw}`;
  return 'Runs on its schedule';
}

export interface ExplainResult {
  fields: CronFieldExplanation[];
  summary: string;
  error: string | null;
}

export function explain(expression: string): ExplainResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { fields: [], summary: '', error: null };
  }
  const lower = trimmed.toLowerCase();
  let normalized = trimmed;
  if (lower.startsWith('@')) {
    const alias = ALIASES[lower];
    if (!alias) {
      return {
        fields: [],
        summary: '',
        error: `Unknown alias "${trimmed}". Supported: @hourly, @daily, @midnight, @weekly, @monthly, @yearly, @annually, @reboot.`,
      };
    }
    normalized = alias;
  }

  const rawParts = normalized.split(/\s+/).filter((p) => p.length > 0);
  if (rawParts.length !== 5 && rawParts.length !== 6) {
    return {
      fields: [],
      summary: '',
      error: `A cron expression must have 5 fields (minute hour day month weekday) or 6 fields (with seconds). Found ${rawParts.length}.`,
    };
  }

  let minuteRaw = rawParts[0]!;
  let hourRaw = rawParts[1]!;
  const domRaw = rawParts[2]!;
  const monthRaw = rawParts[3]!;
  const dowRaw = rawParts[4]!;

  let secondF: CronFieldExplanation | null = null;
  if (rawParts.length === 6) {
    secondF = plainField(FIELD_SPECS[0] as FieldSpec, rawParts[0]!);
    if (!secondF.valid) {
      return { fields: [secondF], summary: '', error: `Invalid seconds field: "${rawParts[0]!}"` };
    }
    minuteRaw = rawParts[1]!;
    hourRaw = rawParts[2]!;
    const shifted = explain5(minuteRaw, hourRaw, rawParts[3]!, rawParts[4]!, rawParts[5]!);
    return secondF.valid ? { ...shifted, fields: [secondF, ...shifted.fields] } : shifted;
  }

  return explain5(minuteRaw, hourRaw, domRaw, monthRaw, dowRaw);
}

function explain5(
  minuteRaw: string,
  hourRaw: string,
  domRaw: string,
  monthRaw: string,
  dowRaw: string
): ExplainResult {
  const minF = plainField(FIELD_SPECS[0] as FieldSpec, minuteRaw);
  const hourF = plainField(FIELD_SPECS[1] as FieldSpec, hourRaw);
  const domF = describeDayOfMonth(domRaw);
  const monthF = plainField(FIELD_SPECS[3] as FieldSpec, monthRaw);
  const dowF = describeDayOfWeek(dowRaw);

  const fields = [minF, hourF, domF, monthF, dowF];
  const invalid = fields.find((f) => !f.valid);
  if (invalid) {
    return {
      fields,
      summary: '',
      error: `Invalid ${invalid.name.toLowerCase()} value: "${invalid.raw}"`,
    };
  }

  const summary = buildSummary(minF, hourF, domF, dowF);
  return { fields, summary, error: null };
}

/** Compute the next `count` run times strictly after `from` for a 5-field cron expression. */
export function nextRuns(
  expression: string,
  from: Date,
  count = 5
): { dates: Date[]; error: string | null } {
  const res = explain(expression);
  if (res.error || res.fields.length < 5)
    return { dates: [], error: res.error ?? 'Invalid expression' };

  const dates: Date[] = [];
  const m = new Date(from.getTime() + 60_000);
  m.setSeconds(0, 0);
  const limit = from.getTime() + 366 * 24 * 60 * 60 * 1000;
  while (dates.length < count && m.getTime() <= limit) {
    if (matchesCron(m, res.fields)) dates.push(new Date(m.getTime()));
    m.setMinutes(m.getMinutes() + 1);
  }
  return { dates, error: null };
}

function matchesCron(date: Date, fields: CronFieldExplanation[]): boolean {
  if (!expandField(fields[0]!.raw, 0, 59, 0).includes(date.getMinutes())) return false;
  if (!expandField(fields[1]!.raw, 0, 23, 0).includes(date.getHours())) return false;
  if (!expandField(fields[3]!.raw, 1, 12, 0).includes(date.getMonth() + 1)) return false;

  const domSpec = fields[2]!.raw;
  const dowSpec = fields[4]!.raw;
  const domStar = domSpec === '*' || domSpec === '?';
  const dowStar = dowSpec === '*' || dowSpec === '?';
  const domMatches = domStar ? true : matchDomSpec(domSpec, date);
  const dowMatches = dowStar ? true : matchDowSpec(dowSpec, date.getDay(), date);
  if (!domStar && !dowStar) return domMatches || dowMatches;
  return domMatches && dowMatches;
}

function matchDomSpec(spec: string, date: Date): boolean {
  const dom = date.getDate();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  if (spec === 'L') return dom === lastDay;
  if (/^LW$/i.test(spec)) return dom === lastDay && date.getDay() >= 1 && date.getDay() <= 5;
  const w = spec.match(/^(\d+)W$/i);
  if (w) {
    const target = nearestWeekday(date.getFullYear(), date.getMonth(), parseInt(w[1]!, 10));
    return dom === target.getDate() && date.getDay() >= 1 && date.getDay() <= 5;
  }
  const lm = spec.match(/^L-(\d+)$/);
  if (lm) return dom === lastDay - parseInt(lm[1]!, 10);
  const list = expandDomField(spec);
  return list !== null && list.includes(dom);
}

function matchDowSpec(spec: string, dow: number, date: Date): boolean {
  const nth = spec.match(/^(\d+)#(\d+)$/i);
  if (nth) {
    if (parseInt(nth[1]!, 10) % 7 !== dow) return false;
    return Math.ceil(date.getDate() / 7) === parseInt(nth[2]!, 10);
  }
  const lastX = spec.match(/^(\d+)L$/i);
  if (lastX) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return dow === parseInt(lastX[1]!, 10) % 7 && date.getDate() > lastDay - 7;
  }
  const list = expandDowField(spec);
  return list !== null && list.includes(dow);
}

function nearestWeekday(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  const dow = d.getDay();
  if (dow === 0) d.setDate(d.getDate() + 1);
  else if (dow === 6) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    d.setDate(day > lastDay - 2 ? day - 2 : day + 2);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  }
  return d;
}

export function expandField(raw: string, min: number, max: number, offset: number): number[] {
  const out = new Set<number>();
  const add = (v: number) => {
    const clamped = v + offset;
    if (clamped >= min && clamped <= max) out.add(clamped);
    else if (offset === -1 && v >= min && v <= max) out.add(v);
  };
  parts: for (const part of raw.split(',')) {
    const rangeStep = part.match(/^(\d+)-(\d+)\/(\d+)$/);
    const stepMatch = part.match(/^\*\/(\d+)$/);
    const range = part.match(/^(\d+)-(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1]!, 10);
      for (let v = min; v <= max; v += step) add(v);
    } else if (rangeStep) {
      const [, a, b, sx] = rangeStep;
      for (let v = parseInt(a!, 10); v <= parseInt(b!, 10); v += parseInt(sx!, 10)) add(v);
    } else if (range) {
      const [, a, b] = range;
      for (let v = parseInt(a!, 10); v <= parseInt(b!, 10); v++) add(v);
    } else if (part === '*' || part === '?') {
      for (let v = min; v <= max; v++) add(v);
    } else {
      const v = parseInt(part, 10);
      if (!Number.isNaN(v)) add(v);
      else break parts;
    }
  }
  void offset;
  return [...out].sort((a, b) => a - b);
}

function expandDomField(raw: string): number[] | null {
  if (raw === '*' || raw === '?') return null;
  if (/[^0-9,*\-/]/.test(raw)) return null; // L/W forms handled by matchDomSpec
  return expandField(raw, 1, 31, 0).filter((v) => v <= 31);
}

function expandDowField(raw: string): number[] | null {
  if (raw === '*' || raw === '?') return null;
  if (/#|L/i.test(raw)) return null;
  const list = expandField(raw === '7' ? '0' : raw, 0, 7, 0).map((v) => (v === 7 ? 0 : v));
  return [...new Set(list)].sort((a, b) => a - b);
}

export function explainState(state: ToolState): ExplainResult {
  return explain(state.expression);
}
