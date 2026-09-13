export const MIN_DB = -60;
export const MAX_DB = 0;

export function clampDb(db: number): number {
  if (!Number.isFinite(db)) return MIN_DB;
  return Math.min(MAX_DB, Math.max(MIN_DB, db));
}

export function roundDb(db: number): number {
  return Math.round(clampDb(db) * 10) / 10;
}

/**
 * PipeWire-Pulse exposes percentage as pa_volume_t / PA_VOLUME_NORM while
 * software amplitude follows PulseAudio's cubic volume mapping.
 */
export function percentToDb(percent: number): number {
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return safePercent <= 0 ? MIN_DB : Math.max(MIN_DB, 60 * Math.log10(safePercent / 100));
}

export function dbToPercent(db: number): number {
  const safeDb = clampDb(db);
  return safeDb <= MIN_DB ? 0 : Math.min(100, Math.max(0, 100 * 10 ** (safeDb / 60)));
}

export function formatDb(db: number): string {
  return clampDb(db) <= MIN_DB ? '−∞ dB' : `${clampDb(db).toFixed(1)} dB`;
}
