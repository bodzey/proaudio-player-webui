import {
  For,
  Show,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from 'solid-js';

import { api } from '../../api/client';
import type { AudioOutput } from '../../api/types';

interface OutputsPanelProps {
  blocked: boolean;
  disabled: boolean;
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

  const hasSnapshot = () => outputs() !== undefined;
  const initialLoading = () => outputs.loading && !hasSnapshot();
  const selectedOutput = () => outputs()?.items.find((output) => output.selected);

  const outputDetails = (output: AudioOutput) => {
    const details: string[] = [];
    const { capabilities } = output;
    if (capabilities.sample_rate) details.push(`${capabilities.sample_rate / 1000} kHz`);
    if (capabilities.channels) details.push(`${capabilities.channels} ch`);
    if (capabilities.sample_format) details.push(capabilities.sample_format);
    if (capabilities.device_bus) details.push(capabilities.device_bus.toUpperCase());
    return details.join(' · ');
  };

  const outputState = (state: string) => {
    if (state === 'running') return 'активний';
    if (state === 'idle') return 'готовий';
    if (state === 'suspended') return 'призупинений';
    return state;
  };

  const refresh = async () => {
    if (outputs.loading) return;
    setError(undefined);
    try {
      await refetch();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const select = async (id: string) => {
    if (pending() !== null || props.blocked || props.disabled) return;
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
    <section class="pro-panel outputs-panel rounded-[28px] border p-5 sm:p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Аудіовихід
          </p>
          <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
            Фізичні аудіовиходи
          </h2>
          <p class="mt-1.5 text-xs leading-5 text-slate-600">
            Вибраний вихід отримує фінальний мікс музики та оповіщень.
          </p>
        </div>
        <button
          type="button"
          class="panel-action-button flex min-w-[112px] items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase transition hover:bg-white/[0.06] hover:text-slate-300 disabled:cursor-default disabled:opacity-60"
          disabled={outputs.loading || props.disabled}
          aria-busy={outputs.loading}
          onClick={() => void refresh()}
        >
          <svg
            viewBox="0 0 24 24"
            class={outputs.loading ? 'size-3.5 animate-spin' : 'size-3.5'}
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 11a8 8 0 1 0-2.34 5.66" />
            <path d="M20 4v7h-7" />
          </svg>
          Оновити
        </button>
      </div>

      <Show when={initialLoading()}>
        <div class="mt-5 min-h-[76px] rounded-2xl border border-white/[0.055] bg-black/15 px-4 py-4 text-xs text-slate-600">
          Пошук фізичних аудіовиходів…
        </div>
      </Show>

      <Show when={hasSnapshot() && (outputs()?.items.length ?? 0) === 0}>
        <div class="mt-5 min-h-[76px] rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] px-4 py-4 text-xs text-amber-100/55">
          Фізичних аудіовиходів не знайдено.
        </div>
      </Show>

      <Show when={(outputs()?.items.length ?? 0) > 0}>
        <Show when={selectedOutput()}>
          {(selected) => (
            <p class="mt-4 text-xs text-slate-500">
              Фінальний мікс спрямовано на{' '}
              <span class="font-medium text-slate-300">{selected().name}</span>.
            </p>
          )}
        </Show>
        <ul class="mt-5 grid gap-2.5 sm:grid-cols-2" aria-label="Доступні аудіовиходи">
          <For each={outputs()?.items ?? []}>
            {(output) => {
              const isPending = () => pending() === output.id;
              return (
                <li class="min-w-0">
                  <button
                    type="button"
                    class={
                      output.selected
                        ? 'output-option is-selected min-h-[76px] rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.055] p-4 text-left shadow-[0_14px_40px_-32px_rgba(34,211,238,0.7)]'
                        : 'output-option min-h-[76px] rounded-2xl border border-white/[0.06] bg-black/15 p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.035]'
                    }
                    disabled={
                      output.selected ||
                      !output.available ||
                      props.blocked ||
                      props.disabled ||
                      pending() !== null
                    }
                    aria-busy={isPending()}
                    aria-pressed={output.selected}
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
                        <div class="flex min-h-4 items-start justify-between gap-2">
                          <span class="truncate text-sm font-semibold text-slate-200">
                            {output.name}
                          </span>
                          <span class="shrink-0 text-[9px] font-semibold tracking-[0.1em] uppercase">
                            <Show
                              when={isPending()}
                              fallback={
                                output.selected ? (
                                  <span class="text-cyan-300/80">Вибрано</span>
                                ) : !output.available ? (
                                  <span class="text-amber-300/70">Недоступний</span>
                                ) : null
                              }
                            >
                              <span class="text-cyan-200/70">Перемикання</span>
                            </Show>
                          </span>
                        </div>
                        <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-slate-500">
                          <span>{outputState(output.state)}</span>
                          <Show when={output.alsa_card !== null}>
                            <span>ALSA {output.alsa_card}</span>
                          </Show>
                          <Show when={output.device_class}>
                            <span>{output.device_class}</span>
                          </Show>
                          <Show when={outputDetails(output)}>
                            <span>{outputDetails(output)}</span>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>

      <Show when={props.blocked}>
        <p class="mt-4 text-[10px] leading-4 text-red-200/45">
          Перемикання виходу заблоковано, доки пріоритетне оповіщення володіє музичною шиною.
        </p>
      </Show>

      <Show when={props.disabled && !props.blocked}>
        <p class="mt-4 text-xs leading-5 text-amber-100/65">
          Керування виходом стане доступним після відновлення зв’язку з плеєром.
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
