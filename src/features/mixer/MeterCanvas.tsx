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
  let resizeFrame = 0;
  let settleFrame = 0;
  let logicalWidth = 0;
  let logicalHeight = 0;
  let renderedDpr = 0;
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

      // Mobile browsers can briefly report a 0/1 px layout while restoring a
      // standalone PWA or switching back from the background. Never replace a
      // valid backing store with that transient size: it would then be stretched
      // by CSS and the stereo bars would look abnormally thin until a reload.
      if (rect.width < 4 || rect.height < 4) return false;

      const scale = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(scale, 0, 0, scale, 0, 0);
      logicalWidth = rect.width;
      logicalHeight = rect.height;
      renderedDpr = scale;
      return true;
    };

    const queueResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      window.cancelAnimationFrame(settleFrame);

      resizeFrame = window.requestAnimationFrame(() => {
        resize();
        // Android/Chromium can restore the visual viewport one frame after the
        // document becomes visible. Recheck once after layout has settled.
        settleFrame = window.requestAnimationFrame(() => {
          resize();
        });
      });
    };

    const observer = new ResizeObserver(queueResize);
    observer.observe(canvas);
    resize();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') queueResize();
    };
    const onPageShow = () => queueResize();
    const onViewportResize = () => queueResize();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('resize', onViewportResize);
    window.addEventListener('orientationchange', onViewportResize);
    window.visualViewport?.addEventListener('resize', onViewportResize);

    let palette = readMeterPalette();
    const refreshPalette = () => {
      palette = readMeterPalette();
    };
    const themeObserver = new MutationObserver(refreshPalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-resolved-theme', 'style'],
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', refreshPalette);

    const draw = (now: number) => {
      const currentDpr = Math.max(1, window.devicePixelRatio || 1);
      if (logicalWidth < 4 || logicalHeight < 4 || Math.abs(currentDpr - renderedDpr) > 0.01) {
        resize();
      }

      const width = logicalWidth || canvas.clientWidth;
      const height = logicalHeight || canvas.clientHeight;
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
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('resize', onViewportResize);
      window.removeEventListener('orientationchange', onViewportResize);
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(settleFrame);
    });
  });

  return (
    <canvas
      ref={(element) => {
        canvas = element;
      }}
      class="mixer-meter h-[292px] w-12 rounded-lg border bg-[var(--pa-meter-bg)]"
      width={44}
      height={286}
      aria-label={`Стереорівень ${BUS_LABELS[props.bus]}`}
      role="img"
    />
  );
};
