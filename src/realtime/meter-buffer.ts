export interface MeterSnapshot {
  sequence: number;
  peak: readonly [number, number];
  rms: readonly [number, number];
  clip: readonly [boolean, boolean];
}

const SILENCE: MeterSnapshot = {
  sequence: 0,
  peak: [-60, -60],
  rms: [-60, -60],
  clip: [false, false],
};

export class MeterBuffer {
  private snapshot: MeterSnapshot = SILENCE;

  write(snapshot: MeterSnapshot): void {
    this.snapshot = snapshot;
  }

  read(): MeterSnapshot {
    return this.snapshot;
  }

  reset(): void {
    this.snapshot = SILENCE;
  }
}
