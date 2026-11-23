import { describe, it, expect } from 'vitest';
import { notepadTool } from '../../src/tool/notepad-state';
import { cronExplainerTool } from '../../src/tool/tool-definition';
import { initialState } from '../../src/tool/types';
import { t, strings } from '../../packages/core/src/i18n/strings';

describe('cronExplainerTool (tool-definition)', () => {
  it('serializes and deserializes round-trip', () => {
    const state = { ...initialState, expression: '*/5 9-17 * * 1-5' };
    const json = cronExplainerTool.serialize(state);
    const result = cronExplainerTool.deserialize(JSON.parse(json));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(state);
    }
  });

  it('rejects non-objects and wrong shapes', () => {
    expect(cronExplainerTool.deserialize(null).success).toBe(false);
    expect(cronExplainerTool.deserialize('string').success).toBe(false);
    expect(cronExplainerTool.deserialize(42).success).toBe(false);
    expect(cronExplainerTool.deserialize({ expression: 42 }).success).toBe(false);
    expect(cronExplainerTool.deserialize({ expression: 'x', error: 5 }).success).toBe(false);
    const bad = cronExplainerTool.deserialize({ nope: true });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error).toMatch(/Invalid data format/);
  });

  it('accepts both error: null and error: string', () => {
    expect(cronExplainerTool.deserialize({ expression: '* * * * *', error: null }).success).toBe(
      true
    );
    expect(cronExplainerTool.deserialize({ expression: '* * * * *', error: 'bad' }).success).toBe(
      true
    );
  });

  it('exposes the four image/pdf exporters', () => {
    expect((cronExplainerTool.exporters ?? []).map((e) => e.format).sort()).toEqual([
      'jpeg',
      'pdf',
      'png',
      'webp',
    ]);
  });
});

describe('notepadTool (legacy tool-definition shape)', () => {
  it('serializes pretty-printed JSON', () => {
    const state = { expression: '0 0 1 1 *', error: null };
    expect(notepadTool.serialize(state)).toBe(JSON.stringify(state, null, 2));
  });

  it('deserializes valid state, keeping a string error', () => {
    const ok = notepadTool.deserialize({ expression: '0 0 1 1 *', error: 'bad cron' });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).toEqual({ expression: '0 0 1 1 *', error: 'bad cron' });
    }
  });

  it('normalises a non-string error to null', () => {
    const ok = notepadTool.deserialize({ expression: '0 0 1 1 *', error: 123 });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).toEqual({ expression: '0 0 1 1 *', error: null });
    }
  });

  it('rejects invalid payloads', () => {
    const bad = notepadTool.deserialize({ expression: 42 });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error).toMatch(/Invalid data format/);
    expect(notepadTool.deserialize(null).success).toBe(false);
  });

  it('exposes id and version', () => {
    expect(notepadTool.id).toBe('cron-expression-explainer');
    expect(notepadTool.version).toBe('1.0.0');
  });
});

describe('i18n t()', () => {
  it('returns plain strings', () => {
    expect(t('undo')).toBe(strings.en.undo);
    expect(t('import')).toBe('Import');
  });

  it('resolves parameterized strings', () => {
    expect(t('exportSuccess', 'en', 'pdf')).toBe('Exported as .pdf');
  });

  it('falls back to the given locale value', () => {
    expect(t('save', 'en')).toBe('Save');
  });
});
