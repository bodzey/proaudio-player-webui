import { createResource, Show } from 'solid-js';

import { api } from '../api/client';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { PriorityBanner } from '../components/PriorityBanner';
import { MixerPanel } from '../features/mixer/MixerPanel';
import { PlayerPanel } from '../features/player/PlayerPanel';
import { SourcesPanel } from '../features/sources/SourcesPanel';
import { MeterBuffer } from '../realtime/meter-buffer';
import { createPlayerState } from '../state/player';

export function App() {
  const player = createPlayerState();
  const [capabilities] = createResource(api.capabilities);
  const meterBuffer = new MeterBuffer();

  return (
    <main class="min-h-screen bg-[#090c11] text-slate-100">
      <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.07),transparent_24%)]" />

      <div class="relative mx-auto min-h-screen max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header class="mb-5 flex items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3.5">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.045] shadow-lg shadow-black/20">
              <svg viewBox="0 0 24 24" class="size-5 text-slate-200" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <path d="M4 15V9M8 18V6M12 20V4M16 17V7M20 14v-4" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="truncate text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                ProAudio Player
              </p>
              <h1 class="mt-0.5 truncate text-base font-semibold tracking-[-0.02em] text-white">
                {player.status()?.name ?? 'Control surface'}
              </h1>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <Show when={capabilities()?.api_version}>
              {(version) => (
                <span class="hidden rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 font-mono text-[10px] text-slate-600 sm:block">
                  API {version()}
                </span>
              )}
            </Show>
            <ConnectionBadge state={player.connection()} />
          </div>
        </header>

        <Show when={player.error()}>
          {(message) => (
            <div class="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] px-4 py-3.5 text-sm text-amber-100/80">
              <span class="mt-1 size-1.5 shrink-0 rounded-full bg-amber-300" />
              <span>{message()}</span>
            </div>
          )}
        </Show>

        <PriorityBanner priority={player.status()?.priority} />

        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div class="min-w-0 space-y-5">
            <PlayerPanel
              status={player.status()}
              pendingAction={player.pendingAction()}
              onAction={(action) => void player.playerAction(action)}
              onVolume={(percent) => void player.setVolume(percent)}
              onMute={(muted) => void player.setMute(muted)}
            />

            <SourcesPanel sources={player.status()?.sources} />
          </div>

          <div class="min-w-0 space-y-5">
            <MixerPanel status={player.status()} buffer={meterBuffer} />

            <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 sm:p-6">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Runtime</p>
                  <h2 class="mt-1.5 text-sm font-semibold text-slate-200">Realtime control plane</h2>
                </div>
                <span class="size-2 rounded-full bg-emerald-400/70 shadow-[0_0_12px_rgba(52,211,153,0.35)]" />
              </div>

              <div class="mt-5 grid grid-cols-3 gap-2.5">
                <RuntimeItem label="State" value={(capabilities()?.events ?? 'SSE').toUpperCase()} />
                <RuntimeItem label="Meters" value="WS next" />
                <RuntimeItem label="Render" value="Canvas" />
              </div>
            </section>
          </div>
        </div>

        <footer class="mt-8 flex flex-col gap-2 border-t border-white/[0.055] pt-4 text-[10px] tracking-[0.08em] text-slate-700 uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>ProAudio Player · newui</span>
          <span>SolidJS · native /api/v1 · realtime first</span>
        </footer>
      </div>
    </main>
  );
}

function RuntimeItem(props: { label: string; value: string }) {
  return (
    <div class="rounded-2xl border border-white/[0.055] bg-black/15 px-3 py-3">
      <div class="text-[9px] font-medium tracking-[0.12em] text-slate-650 uppercase">{props.label}</div>
      <div class="mt-1.5 truncate font-mono text-[11px] text-slate-400">{props.value}</div>
    </div>
  );
}
