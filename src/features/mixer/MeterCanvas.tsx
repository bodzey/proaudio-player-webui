import { onCleanup, onMount, type Component } from 'solid-js';

import type { MeterBuffer, MeterBus } from '../../realtime/meter-buffer';

interface MeterCanvasProps {
  buffer: MeterBuffer;
  bus: MeterBus;
}

const MIN_DB = -60;
const MAX_DB = 0;
const SEGMENTS = 48;
const RMS_ATTACK_SECONDS = 0.032;
const RMS_RELEASE_SECONDS = 0.28;
const PEAK_ATTACK_SECONDS = 0.006;
const PEAK_RELEASE_SECONDS = 0.19;
const PEAK_HOLD_MS = 1050;
const PEAK_DECAY_DB_PER_SECOND = 20;
const CLIP_HOLD_MS = 1800;
const BUS_LABELS: Record<MeterBus, string> = {
  master: 'MASTER',
  music: 'MUSIC',
  alert: 'ALERT',
};

interface MeterPalette {
  background: string;
  inactive: string;
  low: string;
  mid: string;
  high: string;
  peak: string;
  clip: string;
  label: string;
  labelMuted: string;
}

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readMeterPalette(): MeterPalette {
  return {
    background: cssColor('--pa-meter-bg', '#090c11'),
    inactive: cssColor('--pa-meter-off', '#18202b'),
    low: cssColor('--pa-meter-green', '#22c55e'),
    mid: cssColor('--pa-meter-yellow', '#eab308'),
    high: cssColor('--pa-meter-red', '#ef4444'),
    peak: cssColor('--pa-meter-peak', '#e2e8f0'),
    clip: cssColor('--pa-meter-clip', '#f87171'),
    label: cssColor('--pa-meter-label', '#64748b'),
    labelMuted: cssColor('--pa-meter-label-muted', '#334155'),
  };
}

function clampDb(value: number): number {
  return Math.min(MAX_DB, Math.max(MIN_DB, value));
}

function normalized(db: number): number {
  return (clampDb(db) - MIN_DB) / (MAX_DB - MIN_DB);
}

function smoothDb(
  current: number,
  target: number,
  dtSeconds: number,
  attackSeconds: number,
  releaseSeconds: number,
): number {
  const timeConstant = target > current ? attackSeconds : releaseSeconds;
  const alpha = 1 - Math.exp(-dtSeconds / Math.max(0.001, timeConstant));
  return clampDb(current + (target - current) * alpha);
}

export const MeterCanvas: Component<MeterCanvasProps> = (props) => {
  let canvas!: HTMLCanvasElement;
  let animationFrame = 0;
  const displayedRms = [MIN_DB, MIN_DB];
  const displayedPeak = [MIN_DB, MIN_DB];
  const heldPeak = [MIN_DB, MIN_DB];
  const heldUntil = [0, 0];
  const clipUntil = [0, 0];
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

    let palette = readMeterPalette();
    const refreshPalette = () => {
      palette = readMeterPalette();
    };
    const themeObserver = new MutationObserver(refreshPalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', refreshPalette);

    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const snapshot = props.buffer.read(props.bus);
      const dt = Math.min(0.1, Math.max(0, now - lastFrameAt) / 1000);
      lastFrameAt = now;

      context.fillStyle = palette.background;
      context.fillRect(0, 0, width, height);

      const labelHeight = 18;
      const clipHeight = 5;
      const meterTop = 10;
      const meterBottom = height - labelHeight;
      const meterHeight = Math.max(1, meterBottom - meterTop);
      const gap = 5;
      const barWidth = Math.max(5, (width - gap * 3) / 2);
      const xs = [gap, gap * 2 + barWidth];
      const segmentGap = 1;
      const segmentHeight = Math.max(1.5, (meterHeight - segmentGap * (SEGMENTS - 1)) / SEGMENTS);

      for (let channel = 0; channel < 2; channel += 1) {
        const targetPeak = snapshot.available ? clampDb(snapshot.peak[channel] ?? MIN_DB) : MIN_DB;
        const targetRms = snapshot.available ? clampDb(snapshot.rms[channel] ?? MIN_DB) : MIN_DB;

        displayedPeak[channel] = smoothDb(
          displayedPeak[channel]!,
          targetPeak,
          dt,
          PEAK_ATTACK_SECONDS,
          PEAK_RELEASE_SECONDS,
        );
        displayedRms[channel] = smoothDb(
          displayedRms[channel]!,
          targetRms,
          dt,
          RMS_ATTACK_SECONDS,
          RMS_RELEASE_SECONDS,
        );

        if (snapshot.clip[channel] || targetPeak >= -0.1) {
          clipUntil[channel] = now + CLIP_HOLD_MS;
        }

        context.fillStyle = now < clipUntil[channel]! ? palette.clip : palette.inactive;
        context.fillRect(xs[channel]!, 2, barWidth, clipHeight);

        if (displayedPeak[channel]! >= heldPeak[channel]!) {
          heldPeak[channel] = displayedPeak[channel]!;
          heldUntil[channel] = now + PEAK_HOLD_MS;
        } else if (now > heldUntil[channel]!) {
          heldPeak[channel] = Math.max(
            displayedPeak[channel]!,
            heldPeak[channel]! - PEAK_DECAY_DB_PER_SECOND * dt,
          );
        }

        for (let segment = 0; segment < SEGMENTS; segment += 1) {
          const segmentDb = MIN_DB + ((segment + 1) / SEGMENTS) * (MAX_DB - MIN_DB);
          const y = meterBottom - (segment + 1) * segmentHeight - segment * segmentGap;
          const active = segmentDb <= displayedRms[channel]!;
          if (!active) {
            context.fillStyle = palette.inactive;
          } else if (segmentDb >= -3) {
            context.fillStyle = palette.high;
          } else if (segmentDb >= -18) {
            context.fillStyle = palette.mid;
          } else {
            context.fillStyle = palette.low;
          }
          context.fillRect(xs[channel]!, y, barWidth, segmentHeight);
        }

        const visiblePeak = Math.max(displayedPeak[channel]!, heldPeak[channel]!);
        if (snapshot.available || visiblePeak > MIN_DB + 0.1) {
          const peakY = meterBottom - normalized(visiblePeak) * meterHeight;
          context.fillStyle = now < clipUntil[channel]! ? palette.clip : palette.peak;
          context.fillRect(xs[channel]!, peakY, barWidth, 2);
        }
      }

      context.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillStyle = snapshot.available ? palette.label : palette.labelMuted;
      context.fillText('L', xs[0]! + barWidth / 2, height - 2);
      context.fillText('R', xs[1]! + barWidth / 2, height - 2);

      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);

    onCleanup(() => {
      observer.disconnect();
      themeObserver.disconnect();
      scheme.removeEventListener('change', refreshPalette);
      cancelAnimationFrame(animationFrame);
    });
  });

  return (
    <canvas
      ref={(element) => {
        canvas = element;
      }}
      class="mixer-meter min-w-0 max-w-full h-[292px] w-12 rounded-lg border bg-[var(--pa-meter-bg)]"
      aria-label={`Стереорівень ${BUS_LABELS[props.bus]}`}
      role="img"
    />
  );
};
