import { describe, it, expect } from 'vitest';
import { cn } from '../../src/lib/utils';

describe('cn', () => {
  it('joins truthy class names with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops undefined, null, false and empty values', () => {
    expect(cn('a', undefined, null, false, '', 'b')).toBe('a b');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cn(undefined, null, false)).toBe('');
  });
});
