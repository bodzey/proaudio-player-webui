export type MeterBus = 'master' | 'music' | 'alert';

export interface StereoMeterSnapshot {
  peak: readonly [number, number];
  rms: readonly [number, number];
  clip: readonly [boolean, boolean];
  available: boolean;
}

export interface MeterSnapshot {
  sequence: number;
  master: StereoMeterSnapshot;
  music: StereoMeterSnapshot;
  alert: StereoMeterSnapshot;
}

const SILENT_CHANNEL: StereoMeterSnapshot = {
  peak: [-60, -60],
  rms: [-60, -60],
  clip: [false, false],
  available: false,
};

const SILENCE: MeterSnapshot = {
  sequence: 0,
  master: SILENT_CHANNEL,
  music: SILENT_CHANNEL,
  alert: SILENT_CHANNEL,
};

export class MeterBuffer {
  private snapshot: MeterSnapshot = SILENCE;

  write(snapshot: MeterSnapshot): void {
    this.snapshot = snapshot;
  }

  read(bus: MeterBus): StereoMeterSnapshot {
    return this.snapshot[bus];
  }

  sequence(): number {
    return this.snapshot.sequence;
  }

  reset(): void {
    this.snapshot = SILENCE;
  }
}
