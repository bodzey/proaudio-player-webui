import { For, Show, createSignal, type Component } from 'solid-js';

import { api } from '../../api/client';
import type { PlayerStatus } from '../../api/types';
import { StationArtwork } from './StationArtwork';
import { activeRadioStreamUrl } from './presentation';
import { RADIO_STATIONS, isSameRadioStream } from './stations';

interface RadioPanelProps {
  status: PlayerStatus | undefined;
  blocked: boolean;
  disabled: boolean;
}

export const RadioPanel: Component<RadioPanelProps> = (props) => {
  const [pendingUrl, setPendingUrl] = createSignal<string | null>(null);
  const [customUrl, setCustomUrl] = createSignal('');
  const [message, setMessage] = createSignal<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  const currentStreamUrl = () => activeRadioStreamUrl(props.status);

  const play = async (url: string, name: string) => {
    const trimmed = url.trim();
    if (!trimmed || pendingUrl() !== null || props.blocked || props.disabled) return;

    setPendingUrl(trimmed);
    setMessage(null);
    try {
      await api.playStream(trimmed);
      setMessage({ kind: 'success', text: `Запущено: ${name}` });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Не вдалося запустити радіопотік',
      });
    } finally {
      setPendingUrl(null);
    }
  };

  const toggleStation = async (url: string, name: string) => {
    if (!isSameRadioStream(currentStreamUrl(), url)) {
      await play(url, name);
      return;
    }
    if (pendingUrl() !== null || props.blocked || props.disabled) return;

    setPendingUrl(url);
    setMessage(null);
    try {
      await api.playerAction('stop');
      setMessage({ kind: 'success', text: `Зупинено: ${name}` });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Не вдалося зупинити радіопотік',
      });
    } finally {
      setPendingUrl(null);
    }
  };

  return (
    <div class="radio-page space-y-5">
      <section class="pro-panel radio-panel rounded-[28px] border p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Internet radio
            </p>
            <h2 class="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-white">
              Популярні радіостанції
            </h2>
            <p class="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Прямі потоки запускаються через локальний MPD-плеєр. Метадані ефіру, якщо їх передає
              станція, автоматично з’являються у Now Playing.
            </p>
          </div>
          <Show when={currentStreamUrl()}>
            <span class="stream-active-badge w-fit rounded-xl border px-3 py-2 text-[10px] font-semibold tracking-[0.1em] uppercase">
              Потік активний
            </span>
          </Show>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <For each={RADIO_STATIONS}>
            {(station) => {
              const active = () => isSameRadioStream(currentStreamUrl(), station.url);
              const pending = () => pendingUrl() === station.url;

              return (
                <button
                  type="button"
                  class={
                    active()
                      ? 'radio-station-card is-active group overflow-hidden rounded-2xl border text-left transition'
                      : 'radio-station-card group overflow-hidden rounded-2xl border text-left transition'
                  }
                  disabled={props.blocked || props.disabled || pendingUrl() !== null}
                  onClick={() => void toggleStation(station.url, station.name)}
                >
                  <div class="radio-station-layout grid grid-cols-[96px_minmax(0,1fr)_64px]">
                    <StationArtwork
                      station={station}
                      compact
                      class="radio-station-art aspect-square"
                    />
                    <div class="min-w-0 px-4 py-3.5">
                      <div class="min-w-0">
                        <div class="truncate text-sm font-semibold text-slate-100">
                          {station.name}
                        </div>
                        <div class="mt-0.5 truncate text-[10px] font-medium tracking-[0.08em] text-slate-600 uppercase">
                          {station.genre}
                        </div>
                      </div>
                      <p class="mt-2 line-clamp-1 text-[11px] leading-5 text-slate-500">
                        {station.description}
                      </p>
                      <span class="mt-1.5 block font-mono text-[10px] text-slate-600">
                        {station.quality}
                      </span>
                    </div>
                    <div class="radio-station-action flex flex-col items-center justify-center gap-2">
                      <Show
                        when={active()}
                        fallback={
                          <span class="radio-action-button" aria-hidden="true">
                            <svg viewBox="0 0 24 24" class="size-4" fill="currentColor">
                              <path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l9.5-6.4a1 1 0 0 0 0-1.7l-9.5-6.4A1 1 0 0 0 8 5.6Z" />
                            </svg>
                          </span>
                        }
                      >
                        <span class="radio-eq" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span class="radio-action-button is-stop" aria-hidden="true">
                          <span />
                        </span>
                      </Show>
                      <span class="radio-action-label text-[9px] font-semibold tracking-[0.08em] uppercase">
                        {pending() ? 'Підключення' : active() ? 'В ефірі' : 'Слухати'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            }}
          </For>
        </div>

        <Show when={props.blocked}>
          <div class="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[0.045] px-4 py-3 text-xs text-red-200/70">
            Запуск іншого радіопотоку заблоковано активним пріоритетним оповіщенням.
          </div>
        </Show>
      </section>

      <section class="pro-panel radio-panel rounded-[28px] border p-5 sm:p-6">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Власний потік
          </p>
          <h2 class="mt-1.5 text-base font-semibold text-white">Власна адреса потоку</h2>
        </div>

        <form
          class="mt-5 flex flex-col gap-3 lg:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void play(customUrl(), 'власний потік');
          }}
        >
          <input
            type="url"
            required
            value={customUrl()}
            onInput={(event) => setCustomUrl(event.currentTarget.value)}
            placeholder="https://example.org/radio.mp3"
            spellcheck={false}
            aria-label="Адреса аудіопотоку"
            disabled={props.blocked || props.disabled || pendingUrl() !== null}
            class="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-slate-200 transition outline-none placeholder:text-slate-700 focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/10"
          />
          <button
            type="submit"
            disabled={
              props.blocked ||
              props.disabled ||
              pendingUrl() !== null ||
              customUrl().trim().length === 0
            }
            class="radio-play-button rounded-2xl border px-5 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pendingUrl() === customUrl().trim() ? 'Підключення…' : 'Відтворити'}
          </button>
        </form>

        <p class="mt-3 text-xs leading-5 text-slate-500">
          Підтримуються прямі HTTP/HTTPS MP3, AAC, M3U/M3U8 та інші формати, які може відкрити
          MPD/FFmpeg у прошивці.
        </p>

        <Show when={props.disabled && !props.blocked}>
          <p class="mt-4 text-xs leading-5 text-amber-100/65" role="status">
            Відтворення стане доступним після відновлення зв’язку з плеєром.
          </p>
        </Show>

        <div class="radio-feedback-slot" aria-live="polite">
          <Show when={message()}>
            {(result) => (
              <div
                class={
                  result().kind === 'success'
                    ? 'radio-feedback-message rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3.5 py-2.5 text-xs text-emerald-200/75'
                    : 'radio-feedback-message rounded-xl border border-red-400/15 bg-red-400/[0.05] px-3.5 py-2.5 text-xs text-red-200/75'
                }
                role="status"
              >
                {result().text}
              </div>
            )}
          </Show>
        </div>
      </section>
    </div>
  );
};
