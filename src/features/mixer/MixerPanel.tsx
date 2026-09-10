import { type Component } from 'solid-js';

import type { AudioLevel, PlayerStatus } from '../../api/types';
import type { MeterBuffer } from '../../realtime/meter-buffer';
import { MeterCanvas } from './MeterCanvas';

interface MixerPanelProps {
  status?: PlayerStatus;
  buffer: MeterBuffer;
}

function percentToDb(percent: number): number {
  return percent <= 0 ? -60 : Math.max(-60, 20 * Math.log10(percent / 100));
}

function levelFromPercent(percent: number, muted: boolean): AudioLevel {
  return {
    volume: percent,
    db: percentToDb(percent),
    muted,
  };
}

export const MixerPanel: Component<MixerPanelProps> = (props) => {
  const music = () => levelFromPercent(props.status?.audio_levels.music_bus ?? 0, props.status?.muted ?? false);
  const master = () =>
    props.status?.audio_levels.hardware ??
    props.status?.audio_levels.physical ??
    levelFromPercent(0, false);
  const alert = () => props.status?.audio_levels.alert_bus ?? levelFromPercent(0, false);

  return (
    <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] sm:p-6">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Mixer</p>
          <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">Output monitor</h2>
        </div>
        <span class="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-1 font-mono text-[10px] text-slate-500">
          dBFS
        </span>
      </div>

      <div class="relative">
        <MeterCanvas buffer={props.buffer} />
        <div class="pointer-events-none absolute inset-x-10 top-4 flex justify-center">
          <span class="rounded-md bg-black/55 px-2 py-1 text-[9px] font-medium tracking-[0.12em] text-slate-500 uppercase backdrop-blur">
            Meter stream standby
          </span>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-3 gap-2.5">
        <ChannelLevel label="Master" level={master()} />
        <ChannelLevel label="Music" level={music()} />
        <ChannelLevel label="Alert" level={alert()} />
      </div>

      <p class="mt-4 text-[11px] leading-5 text-slate-600">
        Peak/RMS Canvas path is ready. Signal metering stays at −60 dB until the native realtime meter stream is available.
      </p>
    </section>
  );
};

interface ChannelLevelProps {
  label: string;
  level: AudioLevel;
}

const ChannelLevel: Component<ChannelLevelProps> = (props) => {
  const safeVolume = () => Math.min(100, Math.max(0, props.level.volume));

  return (
    <div class="rounded-2xl border border-white/[0.055] bg-black/15 p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-medium text-slate-400">{props.label}</span>
        <span class={props.level.muted ? 'size-1.5 rounded-full bg-red-400' : 'size-1.5 rounded-full bg-emerald-400/70'} />
      </div>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          class="h-full rounded-full bg-slate-400 transition-[width] duration-200"
          style={{ width: `${safeVolume()}%` }}
        />
      </div>
      <div class="mt-2 flex items-end justify-between gap-1">
        <span class="font-mono text-[10px] tabular-nums text-slate-600">{safeVolume().toFixed(0)}%</span>
        <span class="font-mono text-xs font-medium tabular-nums text-slate-300">
          {props.level.db <= -59.95 ? '−∞' : props.level.db.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
