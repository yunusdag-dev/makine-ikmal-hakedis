import { describe, it, expect, vi, afterEach } from 'vitest';
import { bugunTarih } from '../src/renderer/lib/bicim';

afterEach(() => vi.useRealTimers());

describe('Yerel "bugün" tarihi', () => {
  it('gece yarısından sonra (00:00-03:00) UTC değil yerel gün kullanılır', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 1, 30)); // yerel 11 Ağustos 01:30
    expect(bugunTarih()).toBe('2026-08-11');
    vi.setSystemTime(new Date(2026, 0, 1, 0, 5));
    expect(bugunTarih()).toBe('2026-01-01');
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59));
    expect(bugunTarih()).toBe('2026-12-31');
  });
});
