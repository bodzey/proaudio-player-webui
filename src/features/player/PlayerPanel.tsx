import { Show, type Component } from 'solid-js';

import type { PlayerStatus } from '../../api/types';

interface PlayerPanelProps {
  status?: PlayerStatus;
}

export const PlayerPanel: Component<PlayerPanelProps> = (props) => (
  <section class="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Now playing</p>
        <h2 class="mt-2 text-xl font-semibold text-white">
          <Show when={props.status?.player.title} fallback="Немає активного потоку">
            {props.status?.player.title}
          </Show>
        </h2>
        <p class="mt-1 text-sm text-slate-400">
          {props.status?.player.artist || props.status?.player.source || 'ProAudio Player'}
        </p>
      </div>

      <span class="rounded-lg bg-black/20 px-3 py-1.5 font-mono text-xs text-slate-400">
        {props.status?.player.state ?? 'stopped'}
      </span>
    </div>

    <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        class="h-full rounded-full bg-slate-200 transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, props.status?.player.progress ?? 0))}%` }}
      />
    </div>

    <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
      <span>{props.status?.player.elapsed ?? '—'}</span>
      <span>{props.status?.player.duration ?? '—'}</span>
    </div>
  </section>
);
