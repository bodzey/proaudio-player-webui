import { For, Show, createSignal, type Component } from 'solid-js';

import { api } from '../../api/client';
import type { PlayerStatus } from '../../api/types';

interface RadioStation {
  id: string;
  name: string;
  genre: string;
  description: string;
  quality: string;
  url: string;
}

const STATIONS: RadioStation[] = [
  {
    id: 'hitfm',
    name: 'Хіт FM',
    genre: 'Hits / Pop',
    description: 'Популярні українські та світові хіти',
    quality: 'HD',
    url: 'https://online.hitfm.ua/HitFM_HD',
  },
  {
    id: 'kissfm',
    name: 'KISS FM',
    genre: 'Dance / Electronic',
    description: 'Електронна та танцювальна музика',
    quality: 'HD',
    url: 'https://online.kissfm.ua/KissFM_HD',
  },
  {
    id: 'radioroks',
    name: 'Radio ROKS',
    genre: 'Rock',
    description: 'Класичний і сучасний рок',
    quality: 'HD',
    url: 'https://online.radioroks.ua/RadioROKS_HD',
  },
  {
    id: 'relax',
    name: 'Radio Relax',
    genre: 'Relax / Lounge',
    description: 'Спокійна музика та soft pop',
    quality: 'HD',
    url: 'https://online.radiorelax.ua/RadioRelax_HD',
  },
  {
    id: 'nrj',
    name: 'NRJ Ukraine',
    genre: 'Hits / Dance',
    description: 'Сучасна поп- і танцювальна музика',
    quality: '320 kbps',
    url: 'https://cast.mediaonline.net.ua/nrj320',
  },
  {
    id: 'radionv',
    name: 'Radio NV',
    genre: 'News / Talk',
    description: 'Новини, аналітика та розмовні програми',
    quality: 'MP3',
    url: 'https://online-radio.nv.ua/radionv.mp3',
  },
  {
    id: 'ur1',
    name: 'Українське Радіо',
    genre: 'News / Public',
    description: 'Перший канал Суспільного Радіо',
    quality: 'MP3',
    url: 'https://radio.ukr.radio/ur1-mp3',
  },
  {
    id: 'promin',
    name: 'Радіо Промінь',
    genre: 'Ukrainian / Pop',
    description: 'Українська музика та молодіжні програми',
    quality: 'MP3',
    url: 'https://radio.ukr.radio/ur2-mp3',
  },
  {
    id: 'jazz',
    name: 'Radio Jazz',
    genre: 'Jazz',
    description: 'Jazz, soul, funk та суміжні жанри',
    quality: 'HD',
    url: 'https://online.radiojazz.ua/RadioJazz_HD',
  },
  {
    id: 'melodia',
    name: 'Мелодія FM',
    genre: 'Pop / Retro',
    description: 'Відомі хіти різних років',
    quality: 'HD',
    url: 'https://online.melodiafm.ua/MelodiaFM_HD',
  },
];

interface RadioPanelProps {
  status: PlayerStatus | undefined;
  blocked: boolean;
}

export const RadioPanel: Component<RadioPanelProps> = (props) => {
  const [pendingUrl, setPendingUrl] = createSignal<string | null>(null);
  const [customUrl, setCustomUrl] = createSignal('');
  const [message, setMessage] = createSignal<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  const currentStreamUrl = () => {
    const value = props.status?.mpd?.stream_url;
    return typeof value === 'string' ? value : null;
  };

  const play = async (url: string, name: string) => {
    const trimmed = url.trim();
    if (!trimmed || pendingUrl() !== null) return;

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

  return (
    <div class="space-y-5">
      <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Internet radio
            </p>
            <h2 class="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-white">
              Популярні радіостанції
            </h2>
            <p class="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Прямі потоки запускаються через локальний MPD-плеєр. Інші джерела ProAudio Player
              залишаються незалежними від цього списку.
            </p>
          </div>
          <Show when={currentStreamUrl()}>
            <span class="w-fit rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-[10px] font-semibold tracking-[0.1em] text-emerald-300/80 uppercase">
              Stream active
            </span>
          </Show>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <For each={STATIONS}>
            {(station) => {
              const active = () => currentStreamUrl() === station.url;
              const pending = () => pendingUrl() === station.url;

              return (
                <button
                  type="button"
                  class={
                    active()
                      ? 'group rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.055] p-4 text-left shadow-[0_16px_45px_-34px_rgba(52,211,153,0.7)] transition'
                      : 'group rounded-2xl border border-white/[0.065] bg-black/15 p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.035]'
                  }
                  disabled={props.blocked || pendingUrl() !== null}
                  onClick={() => void play(station.url, station.name)}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-3">
                      <div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-sm font-bold text-slate-300">
                        {station.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div class="min-w-0">
                        <div class="truncate text-sm font-semibold text-slate-100">{station.name}</div>
                        <div class="mt-0.5 truncate text-[10px] font-medium tracking-[0.08em] text-slate-600 uppercase">
                          {station.genre}
                        </div>
                      </div>
                    </div>
                    <span
                      class={
                        active()
                          ? 'mt-1 size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
                          : 'mt-1 size-2 shrink-0 rounded-full bg-slate-700 transition group-hover:bg-slate-500'
                      }
                    />
                  </div>

                  <p class="mt-4 min-h-10 text-[11px] leading-5 text-slate-500">
                    {station.description}
                  </p>

                  <div class="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3">
                    <span class="font-mono text-[10px] text-slate-600">{station.quality}</span>
                    <span class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
                      {pending() ? 'Підключення…' : active() ? 'В ефірі' : 'Слухати'}
                    </span>
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

      <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 sm:p-6">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Custom stream
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
            class="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/10"
          />
          <button
            type="submit"
            disabled={props.blocked || pendingUrl() !== null || customUrl().trim().length === 0}
            class="rounded-2xl border border-sky-300/15 bg-sky-400/[0.09] px-5 py-3 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pendingUrl() === customUrl().trim() ? 'Підключення…' : 'Відтворити'}
          </button>
        </form>

        <p class="mt-3 text-[10px] leading-4 text-slate-600">
          Підтримуються прямі HTTP/HTTPS MP3, AAC, M3U/M3U8 та інші формати, які може відкрити
          MPD/FFmpeg у прошивці.
        </p>

        <Show when={message()}>
          {(result) => (
            <div
              class={
                result().kind === 'success'
                  ? 'mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3.5 py-2.5 text-xs text-emerald-200/75'
                  : 'mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-3.5 py-2.5 text-xs text-red-200/75'
              }
              role="status"
            >
              {result().text}
            </div>
          )}
        </Show>
      </section>
    </div>
  );
};
