import { describe, expect, it } from 'vitest';

import { MAX_DB, MIN_DB, clampDb, dbToPercent, percentToDb, roundDb } from './scale';

describe('PulseAudio volume scale', () => {
  it('maps unity to exactly 100% and 0 dB', () => {
    expect(percentToDb(100)).toBe(0);
    expect(dbToPercent(0)).toBe(100);
  });

  it('maps a -12 dB amplitude reduction through the cubic percent scale', () => {
    const percent = dbToPercent(-12);
    expect(percent).toBeCloseTo(63.0957, 4);
    expect(percentToDb(percent)).toBeCloseTo(-12, 10);
  });

  it('clamps invalid and out-of-range values without positive gain', () => {
    expect(clampDb(Number.NaN)).toBe(MIN_DB);
    expect(clampDb(-100)).toBe(MIN_DB);
    expect(clampDb(6)).toBe(MAX_DB);
    expect(percentToDb(Number.POSITIVE_INFINITY)).toBe(MIN_DB);
    expect(dbToPercent(6)).toBe(100);
  });

  it('rounds display and command values to one decimal dB', () => {
    expect(roundDb(-12.26)).toBe(-12.3);
    expect(roundDb(0.04)).toBe(0);
  });
});
