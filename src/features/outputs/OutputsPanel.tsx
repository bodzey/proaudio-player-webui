import { For, Show, createResource, createSignal, onCleanup, onMount, type Component } from 'solid-js';

import { api } from '../../api/client';

interface OutputsPanelProps {
  blocked: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не вдалося отримати аудіовиходи';
}

export const OutputsPanel: Component<OutputsPanelProps> = (props) => {
  const [outputs, { refetch }] = createResource(api.audioOutputs);
  const [pending, setPending] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string>();
  let refreshTimer: number | undefined;

  onMount(() => {
    refreshTimer = window.setInterval(() => void refetch(), 5000);
  });

  onCleanup(() => {
    if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
  });

  const select = async (id: string) => {
    if (pending() !== null || props.blocked) return;
    setPending(id);
    setError(undefined);
    try {
      await api.selectAudioOutput(id);
      await refetch();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  };

  return (
    <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] sm:p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Audio output
          </p>
          <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
            Фізичні аудіовиходи
          </h2>
          <p class="mt-1.5 text-xs leading-5 text-slate-600">
            Вибраний вихід отримує фінальний мікс Music + Alert.
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase transition hover:bg-white/[0.06] hover:text-slate-300"
          onClick={() => void refetch()}
        >
          Оновити
        </button>
      </div>

      <Show when={outputs.loading}>
        <div class="mt-5 rounded-2xl border border-white/[0.055] bg-black/15 px-4 py-4 text-xs text-slate-600">
          Пошук фізичних аудіовиходів…
        </div>
      </Show>

      <Show when={!outputs.loading && (outputs()?.items.length ?? 0) === 0}>
        <div class="mt-5 rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] px-4 py-4 text-xs text-amber-100/55">
          Фізичних аудіовиходів не знайдено.
        </div>
      </Show>

      <div class="mt-5 grid gap-2.5 sm:grid-cols-2">
        <For each={outputs()?.items ?? []}>
          {(output) => (
            <button
              type="button"
              class={
                output.selected
                  ? 'rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.055] p-4 text-left shadow-[0_14px_40px_-32px_rgba(34,211,238,0.7)]'
                  : 'rounded-2xl border border-white/[0.06] bg-black/15 p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.035]'
              }
              disabled={output.selected || props.blocked || pending() !== null}
              onClick={() => void select(output.id)}
            >
              <div class="flex items-start gap-3">
                <span
                  class={
                    output.selected
                      ? 'mt-1 size-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.55)]'
                      : output.state === 'running'
                        ? 'mt-1 size-2 shrink-0 rounded-full bg-emerald-400/80'
                        : 'mt-1 size-2 shrink-0 rounded-full bg-slate-700'
                  }
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <span class="truncate text-sm font-semibold text-slate-200">{output.name}</span>
                    <Show when={output.selected}>
                      <span class="shrink-0 text-[9px] font-semibold tracking-[0.1em] text-cyan-300/80 uppercase">
                        Active
                      </span>
                    </Show>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-slate-600">
                    <span>{output.state}</span>
                    <Show when={output.alsa_card !== null}>
                      <span>ALSA {output.alsa_card}</span>
                    </Show>
                    <Show when={output.device_class}>
                      <span>{output.device_class}</span>
                    </Show>
                  </div>
                  <Show when={pending() === output.id}>
                    <div class="mt-2 text-[10px] text-cyan-200/60">Перемикання…</div>
                  </Show>
                </div>
              </div>
            </button>
          )}
        </For>
      </div>

      <Show when={props.blocked}>
        <p class="mt-4 text-[10px] leading-4 text-red-200/45">
          Перемикання виходу заблоковано, доки пріоритетне оповіщення володіє музичною шиною.
        </p>
      </Show>

      <Show when={error() ?? (outputs.error ? errorMessage(outputs.error) : undefined)}>
        {(message) => (
          <div class="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-3.5 py-2.5 text-xs text-red-200/70">
            {message()}
          </div>
        )}
      </Show>
    </section>
  );
};
