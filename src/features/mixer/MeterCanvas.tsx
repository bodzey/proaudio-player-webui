import { onCleanup, onMount, type Component } from 'solid-js';

import type { MeterBuffer, MeterBus } from '../../realtime/meter-buffer';

interface MeterCanvasProps {
  buffer: MeterBuffer;
  bus: MeterBus;
}

const MIN_DB = -60;
const MAX_DB = 0;
const SEGMENTS = 30;
const PEAK_HOLD_MS = 900;
const PEAK_DECAY_DB_PER_SECOND = 22;

function clampDb(value: number): number {
  return Math.min(MAX_DB, Math.max(MIN_DB, value));
}

function normalized(db: number): number {
  return (clampDb(db) - MIN_DB) / (MAX_DB - MIN_DB);
}

export const MeterCanvas: Component<MeterCanvasProps> = (props) => {
  let canvas!: HTMLCanvasElement;
  let animationFrame = 0;
  const heldPeak = [MIN_DB, MIN_DB];
  const heldUntil = [0, 0];
  let lastFrameAt = performance.now();

  onMount(() => {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      context.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const snapshot = props.buffer.read(props.bus);
      const dt = Math.min(0.1, Math.max(0, now - lastFrameAt) / 1000);
      lastFrameAt = now;

      context.fillStyle = '#090c11';
      context.fillRect(0, 0, width, height);

      const labelHeight = 18;
      const meterTop = 6;
      const meterBottom = height - labelHeight;
      const meterHeight = Math.max(1, meterBottom - meterTop);
      const gap = 5;
      const barWidth = Math.max(5, (width - gap * 3) / 2);
      const xs = [gap, gap * 2 + barWidth];
      const segmentGap = 2;
      const segmentHeight = Math.max(2, (meterHeight - segmentGap * (SEGMENTS - 1)) / SEGMENTS);

      for (let channel = 0; channel < 2; channel += 1) {
        const peak = snapshot.available ? clampDb(snapshot.peak[channel] ?? MIN_DB) : MIN_DB;
        const rms = snapshot.available ? clampDb(snapshot.rms[channel] ?? MIN_DB) : MIN_DB;

        if (peak >= heldPeak[channel]!) {
          heldPeak[channel] = peak;
          heldUntil[channel] = now + PEAK_HOLD_MS;
        } else if (now > heldUntil[channel]!) {
          heldPeak[channel] = Math.max(peak, heldPeak[channel]! - PEAK_DECAY_DB_PER_SECOND * dt);
        }

        for (let segment = 0; segment < SEGMENTS; segment += 1) {
          const segmentDb = MIN_DB + ((segment + 1) / SEGMENTS) * (MAX_DB - MIN_DB);
          const y = meterBottom - (segment + 1) * segmentHeight - segment * segmentGap;
          const active = segmentDb <= rms;
          if (!active) {
            context.fillStyle = '#18202b';
          } else if (segmentDb >= -3) {
            context.fillStyle = '#ef4444';
          } else if (segmentDb >= -12) {
            context.fillStyle = '#eab308';
          } else {
            context.fillStyle = '#22c55e';
          }
          context.fillRect(xs[channel]!, y, barWidth, segmentHeight);
        }

        if (snapshot.available) {
          const peakY = meterBottom - normalized(heldPeak[channel]!) * meterHeight;
          context.fillStyle = snapshot.clip[channel] ? '#f87171' : '#e2e8f0';
          context.fillRect(xs[channel]!, peakY, barWidth, 2);
        }
      }

      context.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillStyle = snapshot.available ? '#64748b' : '#334155';
      context.fillText('L', xs[0]! + barWidth / 2, height - 2);
      context.fillText('R', xs[1]! + barWidth / 2, height - 2);

      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);

    onCleanup(() => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    });
  });

  return (
    <canvas
      ref={(element) => {
        canvas = element;
      }}
      class="h-56 w-11 rounded-lg border border-white/[0.07] bg-[#090c11]"
      aria-label={`${props.bus} stereo signal meter`}
    />
  );
};
