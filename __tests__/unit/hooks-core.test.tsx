import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { compressToEncodedURIComponent } from 'lz-string';
import { useRelativeTime } from '../../packages/core/src/hooks/use-relative-time';
import { useUrlState } from '../../packages/core/src/hooks/use-url-state';
import type { DeserializeResult } from '@itsjust/core';

describe('useRelativeTime', () => {
  it('returns Ready for a missing date', () => {
    const { result } = renderHook(() => useRelativeTime(null));
    expect(result.current).toBe('Ready');
  });

  it('returns Ready for an invalid date string', () => {
    const { result } = renderHook(() => useRelativeTime('not-a-date'));
    expect(result.current).toBe('Ready');
  });

  it('reports just-saved state for a recent date', () => {
    const { result } = renderHook(() => useRelativeTime(new Date().toISOString()));
    expect(result.current).toMatch(/just now/);
  });

  it('reports minutes/hours/days/years ago buckets', () => {
    const cases: Array<[number, RegExp]> = [
      [2 * 60 * 1000, /minute|second/],
      [3 * 60 * 60 * 1000, /hour/],
      [2 * 24 * 60 * 60 * 1000, /day/],
      [400 * 24 * 60 * 60 * 1000, /year/],
    ];
    for (const [ageMs, re] of cases) {
      const { result } = renderHook(() =>
        useRelativeTime(new Date(Date.now() - ageMs).toISOString())
      );
      expect(result.current).toMatch(re);
    }
  });
});

describe('useUrlState', () => {
  const toolId = 'cron-expression-explainer';

  interface UrlStateOpts {
    toolId: string;
    serialize: () => string;
    deserialize: (data: unknown) => DeserializeResult<unknown>;
    onStateLoaded: (data: unknown) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
  }

  function makeOptions(overrides: Partial<UrlStateOpts> = {}): UrlStateOpts {
    return {
      toolId,
      serialize: () => JSON.stringify({ expression: '*/5 * * * *' }),
      deserialize: (data: unknown) => ({ success: true as const, data }),
      onStateLoaded: vi.fn(),
      showToast: vi.fn(),
      ...overrides,
    };
  }

  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing on mount when no state param is present', () => {
    const onStateLoaded = vi.fn();
    const showToast = vi.fn();
    renderHook(() => useUrlState(makeOptions({ onStateLoaded, showToast })));
    expect(onStateLoaded).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('loads state from a compressed shared URL on mount', () => {
    const payload = { expression: '0 9 * * 1-5' };
    const encoded = compressToEncodedURIComponent(JSON.stringify(payload));
    window.history.pushState({}, '', `/?state=${encoded}`);

    const onStateLoaded = vi.fn();
    const showToast = vi.fn();
    renderHook(() => useUrlState(makeOptions({ onStateLoaded, showToast })));
    expect(onStateLoaded).toHaveBeenCalledWith(payload);
    expect(showToast).toHaveBeenCalledWith('Loaded state from shared URL', 'success');
  });

  it('shows an error toast for corrupt shared state', () => {
    window.history.pushState({}, '', '/?state=not-valid-compressed-data!!');
    const showToast = vi.fn();
    renderHook(() => useUrlState(makeOptions({ showToast })));
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows an error toast when deserialization fails', () => {
    const encoded = compressToEncodedURIComponent(JSON.stringify({ expression: 'x' }));
    window.history.pushState({}, '', `/?state=${encoded}`);
    const showToast = vi.fn();
    renderHook(() =>
      useUrlState(
        makeOptions({
          showToast,
          deserialize: () => ({ success: false as const, error: 'Bad shape' }),
        })
      )
    );
    expect(showToast).toHaveBeenCalledWith('Bad shape', 'error');
  });

  it('createShareUrl writes to the clipboard and updates the address bar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    window.history.pushState({}, '', '/');
    const showToast = vi.fn();
    const { result } = renderHook(() => useUrlState(makeOptions({ showToast })));

    let url: string | null = null;
    await act(async () => {
      url = await result.current.createShareUrl();
    });
    expect(url).toContain('state=');
    expect(url).toContain(`tool=${toolId}`);
    expect(writeText).toHaveBeenCalledWith(url);
    expect(showToast).toHaveBeenCalledWith('Share URL copied to clipboard', 'success');
    expect(window.location.search).toContain('state=');
  });

  it('createShareUrl swallows a cancelled Web Share dialog', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('User cancelled'), { name: 'AbortError' }));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    window.history.pushState({}, '', '/');
    const showToast = vi.fn();
    const { result } = renderHook(() => useUrlState(makeOptions({ showToast })));

    let url: string | null = null;
    await act(async () => {
      url = await result.current.createShareUrl('Share this');
    });
    expect(share).toHaveBeenCalled();
    expect(url).toContain('state=');
    // a cancelled share dialog is not an error and does not trigger the copy toast
    expect(showToast).not.toHaveBeenCalled();
  });

  it('createShareUrl reports an error toast and null when the address bar update fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('history blocked');
    });
    window.history.pushState({}, '', '/');
    const showToast = vi.fn();
    const { result } = renderHook(() => useUrlState(makeOptions({ showToast })));

    let url: string | null = 'unset';
    await act(async () => {
      url = await result.current.createShareUrl();
    });
    expect(url).toBeNull();
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
