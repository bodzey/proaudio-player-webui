import type { MeterSnapshot, StereoMeterSnapshot } from '../realtime/meter-buffer';
import { DEMO_MODE } from './demo';
import type { MeterBuffer } from '../realtime/meter-buffer';

interface MeterSubscriptionOptions {
  buffer: MeterBuffer;
  onOpen?: (() => void) | undefined;
  onError?: ((error: Error | undefined) => void) | undefined;
}

function numberPair(value: unknown): readonly [number, number] | undefined {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  ) {
    return [value[0], value[1]];
  }
  return undefined;
}

function booleanPair(value: unknown): readonly [boolean, boolean] | undefined {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'boolean' &&
    typeof value[1] === 'boolean'
  ) {
    return [value[0], value[1]];
  }
  return undefined;
}

function channel(value: unknown): StereoMeterSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const peak = numberPair(record.peak);
  const rms = numberPair(record.rms);
  const clip = booleanPair(record.clip);
  if (!peak || !rms || !clip) return undefined;
  return {
    peak,
    rms,
    clip,
    available: record.available === true,
  };
}

function snapshot(value: unknown): MeterSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const master = channel(record.master);
  const music = channel(record.music);
  const alert = channel(record.alert);
  if (
    !master ||
    !music ||
    !alert ||
    typeof record.sequence !== 'number' ||
    !Number.isSafeInteger(record.sequence) ||
    record.sequence < 0
  ) {
    return undefined;
  }
  return {
    sequence: record.sequence,
    master,
    music,
    alert,
  };
}

export function subscribeToMeterEvents(options: MeterSubscriptionOptions): () => void {
  if (DEMO_MODE) {
    let sequence = 0;
    const frame = () => {
      const time = performance.now() / 1000;
      const stereo = (base: number, swing: number, phase: number): StereoMeterSnapshot => {
        const left = base + Math.sin(time * 3.2 + phase) * swing;
        const right = base + Math.sin(time * 2.7 + phase + 0.7) * swing;
        return {
          peak: [Math.min(-0.8, left + 6), Math.min(-0.8, right + 6)],
          rms: [left, right],
          clip: [false, false],
          available: true,
        };
      };
      options.buffer.write({
        sequence: sequence++,
        music: stereo(-18, 7, 0),
        alert: stereo(-34, 3, 1.4),
        master: stereo(-12, 6, 0.45),
      });
    };
    frame();
    options.onOpen?.();
    const timer = window.setInterval(frame, 20);
    return () => {
      window.clearInterval(timer);
      options.buffer.reset();
    };
  }

  const source = new EventSource('/api/v1/meters');

  source.addEventListener('meter', (event) => {
    try {
      const parsed = snapshot(JSON.parse((event as MessageEvent<string>).data) as unknown);
      if (parsed) options.buffer.write(parsed);
    } catch {
      void 0;
    }
  });

  source.onopen = () => options.onOpen?.();
  source.onerror = () => options.onError?.(undefined);

  return () => {
    source.close();
    options.buffer.reset();
  };
}
