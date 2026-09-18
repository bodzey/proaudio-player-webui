import { onCleanup, onMount, type Component } from 'solid-js';

import type { MeterBuffer, MeterBus } from '../../realtime/meter-buffer';

interface MeterCanvasProps {
  buffer: MeterBuffer;
  bus: MeterBus;
}

const MIN_DB = -60;
const MAX_DB = 0;
const SEGMENTS = 54;
const RMS_ATTACK_SECONDS = 0.055;
const RMS_RELEASE_SECONDS = 0.34;
const PEAK_RELEASE_SECONDS = 0.11;
const PEAK_HOLD_MS = 850;
const PEAK_DECAY_DB_PER_SECOND = 28;
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

function smoothPeak(current: number, target: number, dtSeconds: number): number {
  if (target >= current) return target;
  return smoothDb(current, target, dtSeconds, PEAK_RELEASE_SECONDS, PEAK_RELEASE_SECONDS);
}

function dbToAmplitude(db: number): number {
  if (db <= MIN_DB) return 0;
  return Math.pow(10, clampDb(db) / 20);
}

function amplitudeToDb(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0.001) return MIN_DB;
  return clampDb(20 * Math.log10(amplitude));
}

function stereoRmsDb(leftDb: number, rightDb: number): number {
  const left = dbToAmplitude(leftDb);
  const right = dbToAmplitude(rightDb);
  return amplitudeToDb(Math.sqrt((left * left + right * right) / 2));
}

function levelColor(db: number, palette: MeterPalette): string {
  if (db >= -3) return palette.high;
  if (db >= -18) return palette.mid;
  return palette.low;
}

export const MeterCanvas: Component<MeterCanvasProps> = (props) => {
  let canvas!: HTMLCanvasElement;
  let animationFrame = 0;
  let resizeFrame = 0;
  let settleFrame = 0;
  let logicalWidth = 0;
  let logicalHeight = 0;
  let renderedDpr = 0;
  let displayedRms = MIN_DB;
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
      // by CSS and the meter would look malformed until a reload.
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

    const drawSegmentedLane = (
      x: number,
      laneWidth: number,
      level: number,
      meterBottom: number,
      segmentGap: number,
      segmentHeight: number,
      activeAlpha = 1,
    ) => {
      for (let segment = 0; segment < SEGMENTS; segment += 1) {
        const segmentDb = MIN_DB + ((segment + 1) / SEGMENTS) * (MAX_DB - MIN_DB);
        const y = meterBottom - (segment + 1) * segmentHeight - segment * segmentGap;
        const active = segmentDb <= level;
        context.globalAlpha = active ? activeAlpha : 1;
        context.fillStyle = active ? levelColor(segmentDb, palette) : palette.inactive;
        context.fillRect(x, y, laneWidth, segmentHeight);
      }
      context.globalAlpha = 1;
    };

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

      const labelHeight = 16;
      const clipHeight = 4;
      const meterTop = 9;
      const meterBottom = height - labelHeight;
      const meterHeight = Math.max(1, meterBottom - meterTop);
      const outerPadding = Math.max(3, width * 0.08);
      const laneGap = Math.max(1.5, width * 0.04);
      const usableWidth = Math.max(12, width - outerPadding * 2 - laneGap * 2);
      const peakWidth = Math.max(3, usableWidth * 0.22);
      const rmsWidth = Math.max(5, usableWidth - peakWidth * 2);
      const leftX = outerPadding;
      const rmsX = leftX + peakWidth + laneGap;
      const rightX = rmsX + rmsWidth + laneGap;
      const segmentGap = 1;
      const segmentHeight = Math.max(1.4, (meterHeight - segmentGap * (SEGMENTS - 1)) / SEGMENTS);

      const targetPeak: [number, number] = [
        snapshot.available ? clampDb(snapshot.peak[0] ?? MIN_DB) : MIN_DB,
        snapshot.available ? clampDb(snapshot.peak[1] ?? MIN_DB) : MIN_DB,
      ];
      const targetRms = snapshot.available
        ? stereoRmsDb(snapshot.rms[0] ?? MIN_DB, snapshot.rms[1] ?? MIN_DB)
        : MIN_DB;

      displayedRms = smoothDb(displayedRms, targetRms, dt, RMS_ATTACK_SECONDS, RMS_RELEASE_SECONDS);

      for (let channel = 0; channel < 2; channel += 1) {
        displayedPeak[channel] = smoothPeak(displayedPeak[channel]!, targetPeak[channel]!, dt);

        if (snapshot.clip[channel] || targetPeak[channel]! >= -0.1) {
          clipUntil[channel] = now + CLIP_HOLD_MS;
        }

        if (displayedPeak[channel]! >= heldPeak[channel]!) {
          heldPeak[channel] = displayedPeak[channel]!;
          heldUntil[channel] = now + PEAK_HOLD_MS;
        } else if (now > heldUntil[channel]!) {
          heldPeak[channel] = Math.max(
            displayedPeak[channel]!,
            heldPeak[channel]! - PEAK_DECAY_DB_PER_SECOND * dt,
          );
        }
      }

      drawSegmentedLane(
        leftX,
        peakWidth,
        displayedPeak[0]!,
        meterBottom,
        segmentGap,
        segmentHeight,
      );
      drawSegmentedLane(rmsX, rmsWidth, displayedRms, meterBottom, segmentGap, segmentHeight, 0.72);
      drawSegmentedLane(
        rightX,
        peakWidth,
        displayedPeak[1]!,
        meterBottom,
        segmentGap,
        segmentHeight,
      );

      const laneXs = [leftX, rightX];
      for (let channel = 0; channel < 2; channel += 1) {
        const x = laneXs[channel]!;
        const clipped = now < clipUntil[channel]!;
        context.fillStyle = clipped ? palette.clip : palette.inactive;
        context.fillRect(x, 2, peakWidth, clipHeight);

        const visiblePeak = Math.max(displayedPeak[channel]!, heldPeak[channel]!);
        if (snapshot.available || visiblePeak > MIN_DB + 0.1) {
          const peakY = meterBottom - normalized(visiblePeak) * meterHeight;
          context.fillStyle = clipped ? palette.clip : palette.peak;
          context.fillRect(x - 0.5, peakY, peakWidth + 1, 2);
        }
      }

      context.strokeStyle = palette.inactive;
      context.lineWidth = 1;
      context.strokeRect(rmsX - 0.5, meterTop - 0.5, rmsWidth + 1, meterHeight + 1);

      const labelY = height - 2;
      context.font =
        width < 36
          ? '6px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
          : '7px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillStyle = snapshot.available ? palette.label : palette.labelMuted;
      context.fillText('L', leftX + peakWidth / 2, labelY);
      context.fillText('RMS', rmsX + rmsWidth / 2, labelY);
      context.fillText('R', rightX + peakWidth / 2, labelY);

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
      width={50}
      height={286}
      aria-label={`Рівень ${BUS_LABELS[props.bus]}: піки L/R по краях, stereo RMS по центру`}
      role="img"
    />
  );
};
