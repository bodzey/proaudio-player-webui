import { describe, expect, it } from 'vitest';

import { MeterBuffer, type MeterSnapshot } from './meter-buffer';

const channel = {
  peak: [-6, -7] as const,
  rms: [-12, -13] as const,
  clip: [false, false] as const,
  available: true,
};

const snapshot: MeterSnapshot = {
  sequence: 1,
  master: channel,
  music: channel,
  alert: channel,
};

describe('MeterBuffer', () => {
  it('returns the latest frame while it is fresh', () => {
    let now = 100;
    const buffer = new MeterBuffer(() => now, 500);
    buffer.write(snapshot);
    now = 599;
    expect(buffer.read('master')).toBe(channel);
  });

  it('fails silent when meter delivery stalls', () => {
    let now = 100;
    const buffer = new MeterBuffer(() => now, 500);
    buffer.write(snapshot);
    now = 601;
    expect(buffer.read('master').available).toBe(false);
    expect(buffer.read('master').peak).toEqual([-60, -60]);
  });

  it('clears availability on reset', () => {
    const buffer = new MeterBuffer(() => 100, 500);
    buffer.write(snapshot);
    buffer.reset();
    expect(buffer.read('music').available).toBe(false);
    expect(buffer.sequence()).toBe(0);
  });
});
