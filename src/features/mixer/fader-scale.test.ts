import { describe, expect, it } from 'vitest';

import { FADER_MARKS, dbToFaderPosition, faderPositionToDb } from './fader-scale';

describe('mixer fader scale', () => {
  it('maps every labelled dB mark back to itself', () => {
    for (const db of FADER_MARKS) {
      expect(faderPositionToDb(dbToFaderPosition(db))).toBeCloseTo(db, 1);
    }
  });

  it('clamps positions to the supported dB range', () => {
    expect(faderPositionToDb(-1)).toBe(0);
    expect(faderPositionToDb(2)).toBe(-60);
  });

  it('keeps the mapping monotonic', () => {
    const positions = FADER_MARKS.map(dbToFaderPosition);
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1]!);
    }
  });
});
