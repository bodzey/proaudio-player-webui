import { For, Show, type Component } from 'solid-js';

import type { ActiveSource } from '../../api/types';

interface SourcesPanelProps {
  sources: ActiveSource[] | undefined;
}

export const SourcesPanel: Component<SourcesPanelProps> = (props) => (
  <section class="pro-panel sources-panel rounded-[28px] border p-5 sm:p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Джерела</p>
        <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
          Активні аудіосесії
        </h2>
      </div>
      <span class="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-1 font-mono text-[10px] text-slate-500 tabular-nums">
        {props.sources?.length ?? 0} наживо
      </span>
    </div>

    <div class="mt-5 space-y-2.5">
      <Show
        when={(props.sources?.length ?? 0) > 0}
        fallback={
          <div class="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-white/[0.07] bg-black/10 px-5 text-center text-xs leading-5 text-slate-600">
            На музичній шині немає активних джерел.
          </div>
        }
      >
        <For each={props.sources ?? []}>
          {(source) => (
            <div
              class={
                source.active
                  ? 'source-session is-active rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3.5'
                  : 'source-session rounded-2xl border border-white/[0.055] bg-black/10 p-3.5'
              }
            >
              <div class="flex min-w-0 items-center gap-3">
                <div
                  class={
                    source.active
                      ? 'flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300'
                      : 'flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-slate-600'
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="size-4.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <path d="M5 15v-3M9 18V9M13 16V6M17 19V11M21 15v-5" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="truncate text-sm font-medium text-slate-200">{source.type}</p>
                    <Show when={source.active}>
                      <span class="rounded-md bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-cyan-300 uppercase">
                        активне
                      </span>
                    </Show>
                  </div>
                  <p class="mt-0.5 truncate text-xs text-slate-500">{source.media}</p>
                </div>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  </section>
);
