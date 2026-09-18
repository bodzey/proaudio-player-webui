import { MAX_DB, MIN_DB, clampDb, roundDb } from '../../audio/scale';

export const FADER_MARKS = [0, -3, -6, -9, -12, -18, -24, -30, -36, -48, -60] as const;

const FADER_SCALE = [
  { db: 0, position: 0 },
  { db: -3, position: 0.09 },
  { db: -6, position: 0.17 },
  { db: -9, position: 0.25 },
  { db: -12, position: 0.33 },
  { db: -18, position: 0.47 },
  { db: -24, position: 0.59 },
  { db: -30, position: 0.69 },
  { db: -36, position: 0.77 },
  { db: -48, position: 0.9 },
  { db: -60, position: 1 },
] as const;

export function dbToFaderPosition(db: number): number {
  const value = clampDb(db);
  for (let index = 0; index < FADER_SCALE.length - 1; index += 1) {
    const upper = FADER_SCALE[index]!;
    const lower = FADER_SCALE[index + 1]!;
    if (value <= upper.db && value >= lower.db) {
      const span = upper.db - lower.db;
      const amount = span === 0 ? 0 : (upper.db - value) / span;
      return upper.position + amount * (lower.position - upper.position);
    }
  }
  return value >= MAX_DB ? 0 : 1;
}

export function faderPositionToDb(position: number): number {
  const value = Math.min(1, Math.max(0, position));
  for (let index = 0; index < FADER_SCALE.length - 1; index += 1) {
    const upper = FADER_SCALE[index]!;
    const lower = FADER_SCALE[index + 1]!;
    if (value >= upper.position && value <= lower.position) {
      const span = lower.position - upper.position;
      const amount = span === 0 ? 0 : (value - upper.position) / span;
      return roundDb(upper.db + amount * (lower.db - upper.db));
    }
  }
  return value <= 0 ? MAX_DB : MIN_DB;
}
