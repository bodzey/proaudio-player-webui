import { onCleanup, onMount, type Component } from 'solid-js';

import type { MeterBuffer } from '../../realtime/meter-buffer';

interface MeterCanvasProps {
  buffer: MeterBuffer;
}

const MIN_DB = -60;
const MAX_DB = 0;
const MARKS = [-60, -48, -36, -24, -18, -12, -6, 0] as const;

function clampDb(value: number): number {
  return Math.min(MAX_DB, Math.max(MIN_DB, value));
}

export const MeterCanvas: Component<MeterCanvasProps> = (props) => {
  let canvas!: HTMLCanvasElement;
  let animationFrame = 0;

  onMount(() => {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      return;
    }

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

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const meterTop = 12;
      const meterBottom = height - 28;
      const meterHeight = Math.max(1, meterBottom - meterTop);
      const labelWidth = 34;
      const gap = 8;
      const channelWidth = Math.max(8, (width - labelWidth - gap * 3) / 2);
      const leftX = labelWidth + gap;
      const rightX = leftX + channelWidth + gap;
      const snapshot = props.buffer.read();

      const yForDb = (db: number) => {
        const normalized = (clampDb(db) - MIN_DB) / (MAX_DB - MIN_DB);
        return meterBottom - normalized * meterHeight;
      };

      context.fillStyle = '#0a0d12';
      context.fillRect(0, 0, width, height);

      context.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.textAlign = 'right';
      context.textBaseline = 'middle';

      for (const mark of MARKS) {
        const y = yForDb(mark);
        context.fillStyle = '#6b7280';
        context.fillText(String(mark), labelWidth - 4, y);

        context.strokeStyle = '#1f2937';
        context.beginPath();
        context.moveTo(labelWidth, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const drawChannel = (x: number, peak: number, rms: number, clipped: boolean) => {
        context.fillStyle = '#151a22';
        context.fillRect(x, meterTop, channelWidth, meterHeight);

        const rmsY = yForDb(rms);
        context.fillStyle = '#1f8f5f';
        context.fillRect(x, rmsY, channelWidth, meterBottom - rmsY);

        const peakY = yForDb(peak);
        context.fillStyle = clipped ? '#ef4444' : '#9bd36a';
        context.fillRect(x, peakY, channelWidth, 2);
      };

      drawChannel(leftX, snapshot.peak[0], snapshot.rms[0], snapshot.clip[0]);
      drawChannel(rightX, snapshot.peak[1], snapshot.rms[1], snapshot.clip[1]);

      context.fillStyle = '#9ca3af';
      context.textAlign = 'center';
      context.fillText('L', leftX + channelWidth / 2, height - 12);
      context.fillText('R', rightX + channelWidth / 2, height - 12);

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
      ref={canvas}
      class="h-72 w-full rounded-xl border border-white/10 bg-[#0a0d12]"
      aria-label="Стерео індикатор рівня"
    />
  );
};
