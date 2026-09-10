import { createResource, Show } from 'solid-js';

import { api } from '../api/client';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { MeterCanvas } from '../features/mixer/MeterCanvas';
import { PlayerPanel } from '../features/player/PlayerPanel';
import { MeterBuffer } from '../realtime/meter-buffer';
import { createPlayerState } from '../state/player';

export function App() {
  const player = createPlayerState();
  const [capabilities] = createResource(api.capabilities);
  const meterBuffer = new MeterBuffer();

  return (
    <main class="min-h-screen bg-[#0a0d12] text-slate-100">
      <div class="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header class="mb-8 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
              ProAudio Player
            </p>
            <h1 class="mt-1 text-lg font-semibold text-white">Control surface</h1>
          </div>
          <ConnectionBadge state={player.connection()} />
        </header>

        <Show when={player.error()}>
          {(message) => (
            <div class="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
              {message()}
            </div>
          )}
        </Show>

        <div class="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div class="space-y-5">
            <PlayerPanel status={player.status()} />

            <section class="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div class="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                    Runtime
                  </p>
                  <h2 class="mt-1 font-semibold text-white">Realtime transport</h2>
                </div>
                <span class="font-mono text-xs text-slate-500">
                  API {capabilities()?.api_version ?? 'v1'}
                </span>
              </div>

              <div class="grid gap-3 sm:grid-cols-3">
                <RuntimeItem label="State" value={capabilities()?.events ?? 'SSE'} />
                <RuntimeItem label="Meters" value="WebSocket next" />
                <RuntimeItem label="Rendering" value="Canvas 2D" />
              </div>
            </section>
          </div>

          <section class="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div class="mb-4">
              <p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Mixer</p>
              <h2 class="mt-1 font-semibold text-white">Output level</h2>
              <p class="mt-1 text-xs text-slate-500">
                Canvas rendering path is ready for the native metering stream.
              </p>
            </div>

            <MeterCanvas buffer={meterBuffer} />

            <div class="mt-4 flex items-center justify-between text-sm">
              <span class="text-slate-400">Master</span>
              <span class="font-mono text-slate-200">
                {player.status() ? `${player.status()?.volume.toFixed(1)}%` : '—'}
              </span>
            </div>
          </section>
        </div>

        <footer class="mt-8 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-600">
          <span>newui</span>
          <span>SolidJS · Vite · Rust API</span>
        </footer>
      </div>
    </main>
  );
}

function RuntimeItem(props: { label: string; value: string }) {
  return (
    <div class="rounded-xl border border-white/5 bg-black/10 px-4 py-3">
      <div class="text-xs text-slate-500">{props.label}</div>
      <div class="mt-1 text-sm font-medium text-slate-200">{props.value}</div>
    </div>
  );
}
