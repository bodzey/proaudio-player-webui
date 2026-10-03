import { For, Show, createSignal, onMount, type Component } from 'solid-js';

import { api } from '../../api/client';
import type { PlayerStatus } from '../../api/types';
import { StationArtwork } from './StationArtwork';
import { radioStations, refreshRadioStations } from './catalog';
import { activeRadioStreamUrl } from './presentation';
import { filterRadioStations } from './search';
import { isSameRadioStream } from './stations';

interface RadioPanelProps {
  status: PlayerStatus | undefined;
  blocked: boolean;
  disabled: boolean;
}

export const RadioPanel: Component<RadioPanelProps> = (props) => {
  const [pendingUrl, setPendingUrl] = createSignal<string | null>(null);
  const [customUrl, setCustomUrl] = createSignal('');
  const [query, setQuery] = createSignal('');
  const [messageTarget, setMessageTarget] = createSignal<'catalog' | 'custom'>('catalog');
  const [message, setMessage] = createSignal<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  const currentStreamUrl = () => activeRadioStreamUrl(props.status);
  const filteredStations = () => filterRadioStations(radioStations(), query());

  const feedback = () => (
    <div class="radio-feedback-slot" aria-live="polite">
      <Show when={message()}>
        {(result) => (
          <div
            class={
              result().kind === 'success'
                ? 'radio-feedback-message is-success'
                : 'radio-feedback-message is-error'
            }
            role="status"
          >
            {result().text}
          </div>
        )}
      </Show>
    </div>
  );

  onMount(() => void refreshRadioStations());

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
              Інтернет-радіо
            </p>
            <h2 class="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-white">
              Популярні радіостанції
            </h2>
            <p class="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Знайдіть станцію за назвою або жанром і натисніть «Слухати». Назва передачі чи
              композиції з’явиться у розділі «Плеєр», якщо станція передає ці дані.
            </p>
          </div>
          <Show when={currentStreamUrl()}>
            <span class="stream-active-badge w-fit rounded-xl border px-3 py-2 text-[10px] font-semibold tracking-[0.1em] uppercase">
              Потік активний
            </span>
          </Show>
        </div>

        <div class="radio-search mt-5">
          <label for="radio-search">Пошук станцій</label>
          <div class="radio-search-row">
            <input
              id="radio-search"
              type="search"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder="Назва або жанр"
              aria-controls="radio-stations"
            />
            <Show when={query()}>
              <button type="button" class="ux-button" onClick={() => setQuery('')}>
                Очистити пошук
              </button>
            </Show>
          </div>
          <p class="ux-hint" role="status">
            Станцій: {filteredStations().length} із {radioStations().length}
          </p>
        </div>
        <Show when={messageTarget() === 'catalog'}>{feedback()}</Show>

        <Show when={filteredStations().length === 0}>
          <div class="radio-empty-state">
            <p>Станцій за цим запитом не знайдено. Спробуйте іншу назву або очистіть пошук.</p>
          </div>
        </Show>

        <ul id="radio-stations" class="radio-station-grid mt-6">
          <For each={filteredStations()}>
            {(station) => {
              const active = () => isSameRadioStream(currentStreamUrl(), station.url);
              const pending = () => pendingUrl() === station.url;

              return (
                <li class="min-w-0">
                  <article class={active() ? 'radio-station-card is-active' : 'radio-station-card'}>
                    <div class="radio-station-visual">
                      <StationArtwork station={station} compact class="radio-station-art" />

                      <Show when={active()}>
                        <span class="radio-station-live">
                          <span class="radio-eq" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                          В ефірі
                        </span>
                      </Show>

                      <button
                        type="button"
                        class={active() ? 'radio-station-control is-stop' : 'radio-station-control'}
                        aria-pressed={active()}
                        aria-busy={pending()}
                        aria-label={
                          active() ? `Зупинити ${station.name}` : `Слухати ${station.name}`
                        }
                        disabled={props.blocked || props.disabled || pendingUrl() !== null}
                        onClick={() => {
                          setMessageTarget('catalog');
                          void toggleStation(station.url, station.name);
                        }}
                      >
                        <Show
                          when={pending()}
                          fallback={
                            <Show
                              when={active()}
                              fallback={
                                <svg
                                  viewBox="0 0 24 24"
                                  class="size-5"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l9.5-6.4a1 1 0 0 0 0-1.7l-9.5-6.4A1 1 0 0 0 8 5.6Z" />
                                </svg>
                              }
                            >
                              <span class="radio-stop-icon" aria-hidden="true" />
                            </Show>
                          }
                        >
                          <span class="ux-spinner" aria-hidden="true" />
                        </Show>
                        <span class="sr-only">
                          {pending() ? 'Підключення' : active() ? 'Зупинити' : 'Слухати'}
                        </span>
                      </button>
                    </div>

                    <header class="radio-station-meta">
                      <h3 class="radio-station-name">{station.name}</h3>
                      <p class="radio-station-submeta">
                        <span>{station.genre}</span>
                        <span aria-hidden="true">•</span>
                        <span>{station.quality}</span>
                      </p>
                    </header>
                  </article>
                </li>
              );
            }}
          </For>
        </ul>

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
            setMessageTarget('custom');
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
            aria-busy={pendingUrl() === customUrl().trim()}
          >
            {pendingUrl() === customUrl().trim() ? 'Підключення…' : 'Відтворити'}
          </button>
        </form>

        <p class="mt-3 text-xs leading-5 text-slate-500">
          Вставте пряму HTTP/HTTPS адресу аудіопотоку або плейлиста MP3, AAC чи M3U/M3U8. Посилання
          на сторінку радіостанції не підійде.
        </p>

        <Show when={props.disabled && !props.blocked}>
          <p class="mt-4 text-xs leading-5 text-amber-100/65" role="status">
            Відтворення стане доступним після відновлення зв’язку з плеєром.
          </p>
        </Show>

        <Show when={messageTarget() === 'custom'}>{feedback()}</Show>
      </section>
    </div>
  );
};
