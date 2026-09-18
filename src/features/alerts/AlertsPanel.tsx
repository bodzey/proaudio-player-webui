import { For, Show, createSignal, onMount, type Component } from 'solid-js';

import { api } from '../../api/client';
import type {
  AlertMediaFile,
  AlertMediaKind,
  AlertMediaResponse,
  AlertProviderSettings,
  AudioSettings,
  PriorityState,
} from '../../api/types';
import { audioPayload, providerPayload } from './form';

interface AlertsPanelProps {
  priority: PriorityState | undefined;
}

type BusyAction = 'save' | 'test' | null;
type MessageTone = 'success' | 'error' | 'neutral';

interface FormMessage {
  tone: MessageTone;
  text: string;
}

const INPUT_CLASS =
  'mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-sky-300/30 focus:bg-black/30';
const LABEL_CLASS = 'text-xs font-medium text-slate-400';
const HELP_CLASS = 'mt-1.5 block text-[10px] leading-4 text-slate-600';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Невідома помилка';
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

function formatMediaTimestamp(value: number | null): string {
  return value === null ? '—' : new Date(value * 1000).toLocaleString('uk-UA');
}

function formatBytes(value: number | null): string {
  if (value === null) return '—';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function messageClass(message: FormMessage | undefined): string {
  if (message?.tone === 'error') {
    return 'text-red-300';
  }
  if (message?.tone === 'success') {
    return 'text-emerald-300';
  }
  return 'text-slate-500';
}

export const AlertsPanel: Component<AlertsPanelProps> = (props) => {
  const [provider, setProvider] = createSignal<AlertProviderSettings>();
  const [audio, setAudio] = createSignal<AudioSettings>();
  const [media, setMedia] = createSignal<AlertMediaResponse>();
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string>();
  const [providerBusy, setProviderBusy] = createSignal<BusyAction>(null);
  const [audioBusy, setAudioBusy] = createSignal(false);
  const [providerMessage, setProviderMessage] = createSignal<FormMessage>();
  const [audioMessage, setAudioMessage] = createSignal<FormMessage>();
  const [mediaBusy, setMediaBusy] = createSignal<AlertMediaKind>();
  const [mediaMessages, setMediaMessages] = createSignal<
    Partial<Record<AlertMediaKind, FormMessage>>
  >({});

  let providerForm!: HTMLFormElement;
  let audioForm!: HTMLFormElement;

  async function loadSettings(): Promise<void> {
    setLoading(true);
    setLoadError(undefined);
    const [providerResult, audioResult, mediaResult] = await Promise.allSettled([
      api.alertSettings(),
      api.audioSettings(),
      api.alertMedia(),
    ]);
    const errors: string[] = [];
    if (providerResult.status === 'fulfilled') {
      setProvider(providerResult.value);
    } else {
      errors.push(`API тривог: ${errorText(providerResult.reason)}`);
    }
    if (audioResult.status === 'fulfilled') {
      setAudio(audioResult.value);
    } else {
      errors.push(`аудіопараметри: ${errorText(audioResult.reason)}`);
    }
    if (mediaResult.status === 'fulfilled') {
      setMedia(mediaResult.value);
    } else {
      errors.push(`файли сповіщень: ${errorText(mediaResult.reason)}`);
    }
    setLoadError(errors.length > 0 ? errors.join('; ') : undefined);
    setLoading(false);
  }

  async function saveProvider(): Promise<void> {
    if (!providerForm.reportValidity()) {
      return;
    }
    let payload;
    try {
      // Snapshot successful controls before `busy` disables the fieldset.
      // Disabled controls are intentionally omitted by the FormData algorithm.
      payload = providerPayload(new FormData(providerForm));
    } catch (error) {
      setProviderMessage({ tone: 'error', text: errorText(error) });
      return;
    }
    setProviderBusy('save');
    setProviderMessage({ tone: 'neutral', text: 'Збереження…' });
    try {
      const next = await api.setAlertSettings(payload);
      setProvider(next);
      const token = providerForm.elements.namedItem('token');
      if (token instanceof HTMLInputElement) {
        token.value = '';
      }
      setProviderMessage({ tone: 'success', text: 'Налаштування API збережено.' });
    } catch (error) {
      setProviderMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setProviderBusy(null);
    }
  }

  async function testProvider(): Promise<void> {
    if (!providerForm.reportValidity()) {
      return;
    }
    let payload;
    try {
      payload = providerPayload(new FormData(providerForm));
    } catch (error) {
      setProviderMessage({ tone: 'error', text: errorText(error) });
      return;
    }
    setProviderBusy('test');
    setProviderMessage({ tone: 'neutral', text: 'Перевірка API…' });
    try {
      const result = await api.testAlertSettings(payload);
      setProviderMessage({
        tone: 'success',
        text: result.active
          ? `API доступний. Для UID ${result.location_uid} тривога активна.`
          : `API доступний. Для UID ${result.location_uid} активної тривоги немає.`,
      });
    } catch (error) {
      setProviderMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setProviderBusy(null);
    }
  }

  async function saveAudio(): Promise<void> {
    if (!audioForm.reportValidity()) {
      return;
    }
    let payload;
    try {
      payload = audioPayload(new FormData(audioForm));
    } catch (error) {
      setAudioMessage({ tone: 'error', text: errorText(error) });
      return;
    }
    setAudioBusy(true);
    setAudioMessage({ tone: 'neutral', text: 'Збереження…' });
    try {
      const next = await api.setAudioSettings(payload);
      setAudio(next);
      setAudioMessage({ tone: 'success', text: 'Параметри оповіщень збережено.' });
    } catch (error) {
      setAudioMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setAudioBusy(false);
    }
  }

  function updateMediaFile(next: AlertMediaFile): void {
    setMedia((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.kind === next.kind ? next : item)),
          }
        : current,
    );
  }

  function setMediaMessage(kind: AlertMediaKind, message: FormMessage): void {
    setMediaMessages((messages) => ({ ...messages, [kind]: message }));
  }

  async function uploadMedia(kind: AlertMediaKind, file: File): Promise<void> {
    const maximum = media()?.max_size_bytes ?? 16 * 1024 * 1024;
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      setMediaMessage(kind, { tone: 'error', text: 'Оберіть файл із розширенням .mp3.' });
      return;
    }
    if (file.size > maximum) {
      setMediaMessage(kind, {
        tone: 'error',
        text: `Файл завеликий. Максимум ${formatBytes(maximum)}.`,
      });
      return;
    }
    setMediaBusy(kind);
    setMediaMessage(kind, { tone: 'neutral', text: 'Завантаження…' });
    try {
      updateMediaFile(await api.setAlertMedia(kind, file));
      setMediaMessage(kind, { tone: 'success', text: 'Новий файл встановлено.' });
    } catch (error) {
      setMediaMessage(kind, { tone: 'error', text: errorText(error) });
    } finally {
      setMediaBusy(undefined);
    }
  }

  async function resetMedia(kind: AlertMediaKind): Promise<void> {
    if (!window.confirm('Відновити заводський файл цього сповіщення?')) return;
    setMediaBusy(kind);
    setMediaMessage(kind, { tone: 'neutral', text: 'Відновлення…' });
    try {
      updateMediaFile(await api.resetAlertMedia(kind));
      setMediaMessage(kind, { tone: 'success', text: 'Заводський файл відновлено.' });
    } catch (error) {
      setMediaMessage(kind, { tone: 'error', text: errorText(error) });
    } finally {
      setMediaBusy(undefined);
    }
  }

  onMount(() => {
    void loadSettings();
  });

  return (
    <div class="alerts-page space-y-5">
      <section class="pro-panel alerts-card rounded-[28px] border p-5 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Оповіщення
            </p>
            <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
              Стан системи тривог
            </h2>
            <p class="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
              Поточний статус роботи системи оповіщень та останні події.
            </p>
          </div>
          <div
            class={
              props.priority?.active
                ? 'alert-duty-badge is-active flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium'
                : audio()?.air_raid_alerts_enabled === false
                  ? 'alert-duty-badge is-disabled flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium'
                  : 'alert-duty-badge flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium'
            }
          >
            <span class="size-2 rounded-full" />
            {props.priority?.minute_silence_active
              ? 'Хвилина мовчання'
              : props.priority?.active
                ? 'Тривога активна'
                : audio()?.air_raid_alerts_enabled === false
                  ? 'Система вимкнена'
                  : 'Черговий режим'}
          </div>
        </div>

        <div class="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatusItem label="Режим" value={props.priority?.mode ?? '—'} />
          <StatusItem
            label="Остання відповідь API"
            value={formatTimestamp(props.priority?.last_success_at)}
          />
          <StatusItem
            label="Остання зміна"
            value={formatTimestamp(props.priority?.last_change_at)}
          />
          <StatusItem
            label="UID у тривозі"
            value={
              props.priority?.matched_uids?.length ? props.priority.matched_uids.join(', ') : '—'
            }
          />
        </div>

        <Show when={props.priority?.last_error}>
          {(lastError) => (
            <div class="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-3.5 py-3 text-xs text-red-200/75">
              {lastError()}
            </div>
          )}
        </Show>
      </section>

      <Show when={loadError()}>
        {(error) => (
          <div class="rounded-2xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3.5 text-sm text-red-200/80">
            Не вдалося завантажити налаштування: {error()}
            <button
              type="button"
              class="ml-3 font-semibold text-red-100 underline decoration-red-300/30 underline-offset-4"
              onClick={() => void loadSettings()}
            >
              Повторити
            </button>
          </div>
        )}
      </Show>

      <Show
        when={provider()}
        fallback={
          <Show when={loading()}>
            <LoadingCard />
          </Show>
        }
        keyed
      >
        {(settings) => (
          <section class="pro-panel alerts-card rounded-[28px] border p-5 sm:p-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                  Alerts API
                </p>
                <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
                  API повітряних тривог
                </h2>
                <p class="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
                  Параметри провайдера alerts.in.ua. Тест перевіряє введені значення без їх
                  збереження.
                </p>
              </div>
              <span
                class={
                  settings.token_configured
                    ? 'w-fit rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-[11px] text-emerald-200/75'
                    : 'w-fit rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-[11px] text-amber-200/75'
                }
              >
                {settings.token_configured ? 'Токен налаштовано' : 'Токен відсутній'}
              </span>
            </div>

            <form
              ref={(element) => {
                providerForm = element;
              }}
              class="mt-6 grid gap-4 md:grid-cols-2"
              aria-busy={providerBusy() !== null}
              onSubmit={(event) => {
                event.preventDefault();
                void saveProvider();
              }}
            >
              <fieldset class="contents" disabled={providerBusy() !== null}>
                <label class={`${LABEL_CLASS} md:col-span-2`}>
                  Шаблон адреси API
                  <input
                    class={INPUT_CLASS}
                    name="endpoint"
                    type="text"
                    inputmode="url"
                    spellcheck={false}
                    required
                    maxlength="2048"
                    value={settings.endpoint}
                  />
                  <span class={HELP_CLASS}>
                    Адреса повинна містити <code class="font-mono text-slate-500">{'{uid}'}</code>.
                  </span>
                </label>

                <label class={LABEL_CLASS}>
                  UID локації
                  <input
                    class={INPUT_CLASS}
                    name="location_uid"
                    type="number"
                    min="1"
                    max="4294967295"
                    step="1"
                    required
                    value={settings.location_uid}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Тип локації
                  <select class={INPUT_CLASS} name="location_type" value={settings.location_type}>
                    <option value="hromada">Територіальна громада</option>
                    <option value="city">Місто</option>
                    <option value="raion">Район</option>
                    <option value="oblast">Область</option>
                    <option value="standalone">Окрема територія</option>
                  </select>
                </label>

                <label class={`${LABEL_CLASS} md:col-span-2`}>
                  Новий API-токен
                  <input
                    class={INPUT_CLASS}
                    name="token"
                    type="password"
                    autocomplete="new-password"
                    maxlength="4096"
                    placeholder="Залиште порожнім, щоб не змінювати"
                  />
                  <span class={HELP_CLASS}>
                    Збережений токен ніколи не передається назад у браузер.
                  </span>
                </label>

                <label class={LABEL_CLASS}>
                  Інтервал опитування, с
                  <input
                    class={INPUT_CLASS}
                    name="poll_interval_seconds"
                    type="number"
                    min="8"
                    max="3600"
                    step="1"
                    required
                    value={settings.poll_interval_seconds}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Очікування відповіді, с
                  <input
                    class={INPUT_CLASS}
                    name="request_timeout_seconds"
                    type="number"
                    min="0.1"
                    max="120"
                    step="0.1"
                    required
                    value={settings.request_timeout_seconds}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Пауза після HTTP 429, с
                  <input
                    class={INPUT_CLASS}
                    name="rate_limit_backoff_seconds"
                    type="number"
                    min="60"
                    max="86400"
                    step="1"
                    required
                    value={settings.rate_limit_backoff_seconds}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Підтверджень відбою
                  <input
                    class={INPUT_CLASS}
                    name="clear_confirmations"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    required
                    value={settings.clear_confirmations}
                  />
                </label>
              </fieldset>

              <div class="flex flex-col gap-3 border-t border-white/[0.055] pt-5 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
                <span
                  class={`min-h-5 text-xs ${messageClass(providerMessage())}`}
                  role="status"
                  aria-live="polite"
                >
                  {providerMessage()?.text ?? ''}
                </span>
                <div class="flex gap-2.5">
                  <button
                    type="button"
                    class="rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.065] disabled:cursor-wait disabled:opacity-45"
                    disabled={providerBusy() !== null}
                    onClick={() => void testProvider()}
                  >
                    {providerBusy() === 'test' ? 'Перевірка…' : 'Перевірити API'}
                  </button>
                  <button
                    type="submit"
                    class="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-45"
                    disabled={providerBusy() !== null}
                  >
                    {providerBusy() === 'save' ? 'Збереження…' : 'Зберегти'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}
      </Show>

      <Show when={media()} keyed>
        {(files) => (
          <section class="pro-panel alerts-card rounded-[28px] border p-5 sm:p-6">
            <div>
              <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                Alert media
              </p>
              <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
                Файли сповіщень
              </h2>
              <p class="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
                Власні MP3 зберігаються у постійному сховищі та не губляться після оновлення
                прошивки. Максимальний розмір одного файла — {formatBytes(files.max_size_bytes)}.
              </p>
            </div>

            <div class="mt-5 grid gap-3 lg:grid-cols-3">
              <For each={files.items}>
                {(item) => (
                  <article class="alert-media-card flex flex-col rounded-2xl border p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <h3 class="text-sm font-semibold text-slate-200">{item.label}</h3>
                        <p class="mt-1 font-mono text-[10px] text-slate-600">{item.file_name}</p>
                      </div>
                      <span
                        class={
                          item.configured
                            ? 'rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1 text-[9px] font-semibold text-emerald-200/75 uppercase'
                            : 'rounded-lg border border-red-400/15 bg-red-400/[0.05] px-2 py-1 text-[9px] font-semibold text-red-200/75 uppercase'
                        }
                      >
                        {item.configured ? 'Готово' : 'Відсутній'}
                      </span>
                    </div>

                    <dl class="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <dt class="text-slate-600">Розмір</dt>
                        <dd class="mt-0.5 text-slate-400">{formatBytes(item.size_bytes)}</dd>
                      </div>
                      <div>
                        <dt class="text-slate-600">Оновлено</dt>
                        <dd class="mt-0.5 text-slate-400">
                          {formatMediaTimestamp(item.modified_unix_seconds)}
                        </dd>
                      </div>
                    </dl>

                    <div class="mt-auto flex flex-wrap gap-2 pt-5">
                      <label
                        class={`cursor-pointer rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-white ${
                          mediaBusy() ? 'pointer-events-none opacity-45' : ''
                        }`}
                      >
                        {mediaBusy() === item.kind ? 'Завантаження…' : 'Обрати MP3'}
                        <input
                          class="sr-only"
                          type="file"
                          accept=".mp3,audio/mpeg,audio/mp3"
                          disabled={mediaBusy() !== undefined}
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const file = input.files?.[0];
                            input.value = '';
                            if (file) void uploadMedia(item.kind, file);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        class="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.065] disabled:cursor-wait disabled:opacity-45"
                        disabled={mediaBusy() !== undefined}
                        onClick={() => void resetMedia(item.kind)}
                      >
                        Відновити
                      </button>
                    </div>
                    <span
                      class={`mt-3 min-h-4 text-[10px] ${messageClass(mediaMessages()[item.kind])}`}
                      role="status"
                      aria-live="polite"
                    >
                      {mediaMessages()[item.kind]?.text ?? ''}
                    </span>
                  </article>
                )}
              </For>
            </div>
          </section>
        )}
      </Show>

      <Show when={audio()} keyed>
        {(settings) => (
          <section class="pro-panel alerts-card rounded-[28px] border p-5 sm:p-6">
            <div>
              <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                Alert audio
              </p>
              <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
                Оповіщення та хвилина мовчання
              </h2>
              <p class="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
                Два незалежні сценарії: оповіщення про повітряну тривогу та щоденна хвилина
                мовчання. Вимкнення одного не вимикає інший. Рівень ALERT задається одним фейдером у
                мікшері та зберігається автоматично.
              </p>
            </div>

            <div class="mt-5 flex flex-wrap gap-2" aria-label="Домен обробки аудіо">
              <span class="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-1.5 font-mono text-[11px] text-slate-400">
                {settings.sample_rate_mode === 'fixed'
                  ? 'Фіксований домен'
                  : settings.sample_rate_mode}
              </span>
              <span class="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-1.5 font-mono text-[11px] text-slate-400">
                {(settings.sample_rate / 1000).toFixed(1)} kHz · stereo
              </span>
              <span class="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-1.5 font-mono text-[11px] text-slate-500">
                100% = 0.00 dB
              </span>
            </div>

            <form
              ref={(element) => {
                audioForm = element;
              }}
              class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              aria-busy={audioBusy()}
              onSubmit={(event) => {
                event.preventDefault();
                void saveAudio();
              }}
            >
              <fieldset class="contents" disabled={audioBusy()}>
                <label class="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.065] bg-black/15 p-4 md:col-span-2 xl:col-span-3">
                  <input
                    class="mt-0.5 size-4 accent-sky-400"
                    name="air_raid_alerts_enabled"
                    type="checkbox"
                    checked={
                      settings.air_raid_alerts_enabled ?? settings.notifications_enabled ?? true
                    }
                  />
                  <span>
                    <b class="block text-xs font-semibold text-slate-300">
                      Оповіщення про повітряну тривогу
                    </b>
                    <span class="mt-1 block text-[10px] leading-4 text-slate-600">
                      Керує лише alerts.in.ua: якщо вимкнути, плеєр припинить опитування API,
                      завершить активну тривогу та відновить музику. Хвилина мовчання працює
                      незалежно.
                    </span>
                  </span>
                </label>

                <label class={LABEL_CLASS}>
                  Стишення музики, dB
                  <input
                    class={INPUT_CLASS}
                    name="duck_db"
                    type="number"
                    min="-60"
                    max="0"
                    step="0.1"
                    required
                    value={settings.duck_db}
                  />
                </label>

                <label class="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.065] bg-black/15 p-4 md:col-span-2 xl:col-span-3">
                  <input
                    class="mt-0.5 size-4 accent-sky-400"
                    name="minute_silence_enabled"
                    type="checkbox"
                    checked={settings.minute_silence_enabled}
                  />
                  <span>
                    <b class="block text-xs font-semibold text-slate-300">
                      Увімкнути хвилину мовчання
                    </b>
                    <span class="mt-1 block text-[10px] leading-4 text-slate-600">
                      Незалежний щоденний сценарій. Запускається один раз на добу за вказаним
                      локальним часом, навіть якщо оповіщення про повітряну тривогу вимкнені.
                    </span>
                  </span>
                </label>

                <label class={LABEL_CLASS}>
                  Час початку
                  <input
                    class={INPUT_CLASS}
                    name="minute_silence_start_time"
                    type="time"
                    step="1"
                    required
                    value={settings.minute_silence_start_time}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Часовий пояс
                  <input
                    class={INPUT_CLASS}
                    name="minute_silence_timezone"
                    type="text"
                    list="minute-silence-timezones"
                    required
                    spellcheck={false}
                    value={settings.minute_silence_timezone}
                  />
                  <datalist id="minute-silence-timezones">
                    <option value="Europe/Kyiv" />
                    <option value="UTC" />
                  </datalist>
                </label>

                <label class={LABEL_CLASS}>
                  Допустиме запізнення, с
                  <input
                    class={INPUT_CLASS}
                    name="minute_silence_catch_up_seconds"
                    type="number"
                    min="0"
                    max="86400"
                    step="1"
                    required
                    value={settings.minute_silence_catch_up_seconds}
                  />
                  <span class={HELP_CLASS}>Вікно запуску після перезавантаження або простою.</span>
                </label>

                <label class={LABEL_CLASS}>
                  Плавне стишення музики, с
                  <input
                    class={INPUT_CLASS}
                    name="minute_silence_music_fade_seconds"
                    type="number"
                    min="0"
                    max="60"
                    step="0.1"
                    required
                    value={settings.minute_silence_music_fade_seconds}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Гучність хвилини мовчання, %
                  <input
                    class={INPUT_CLASS}
                    name="minute_silence_volume_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    value={settings.minute_silence_volume_percent}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Рівень відновлення без знімка, %
                  <input
                    class={INPUT_CLASS}
                    name="default_restore_volume_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    value={settings.default_restore_volume_percent}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Час стишення, с
                  <input
                    class={INPUT_CLASS}
                    name="duck_fade_seconds"
                    type="number"
                    min="0"
                    max="60"
                    step="0.1"
                    required
                    value={settings.duck_fade_seconds}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Час відновлення, с
                  <input
                    class={INPUT_CLASS}
                    name="restore_fade_seconds"
                    type="number"
                    min="0"
                    max="60"
                    step="0.1"
                    required
                    value={settings.restore_fade_seconds}
                  />
                </label>

                <label class={LABEL_CLASS}>
                  Повторення активної тривоги, хв
                  <input
                    class={INPUT_CLASS}
                    name="alert_repeat_interval_minutes"
                    type="number"
                    min="0"
                    max="1440"
                    step="1"
                    required
                    value={settings.alert_repeat_interval_minutes}
                  />
                  <span class={HELP_CLASS}>0 — не повторювати.</span>
                </label>

                <label class="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.065] bg-black/15 p-4 md:col-span-2 xl:col-span-2">
                  <input
                    class="mt-0.5 size-4 accent-sky-400"
                    name="duck_only_during_announcement"
                    type="checkbox"
                    checked={settings.duck_only_during_announcement}
                  />
                  <span>
                    <b class="block text-xs font-semibold text-slate-300">
                      Приглушувати лише під час сповіщення про тривогу та відбій
                    </b>
                    <span class="mt-1 block text-[10px] leading-4 text-slate-600">
                      Після аудіофайлу музика повертається до попереднього рівня, навіть якщо
                      тривога триває.
                    </span>
                  </span>
                </label>
              </fieldset>

              <div class="flex flex-col gap-3 border-t border-white/[0.055] pt-5 sm:flex-row sm:items-center sm:justify-between md:col-span-2 xl:col-span-3">
                <span
                  class={`min-h-5 text-xs ${messageClass(audioMessage())}`}
                  role="status"
                  aria-live="polite"
                >
                  {audioMessage()?.text ?? ''}
                </span>
                <button
                  type="submit"
                  class="w-fit rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-45"
                  disabled={audioBusy()}
                >
                  {audioBusy() ? 'Збереження…' : 'Зберегти аудіоналаштування'}
                </button>
              </div>
            </form>
          </section>
        )}
      </Show>
    </div>
  );
};

interface StatusItemProps {
  label: string;
  value: string;
}

const StatusItem: Component<StatusItemProps> = (props) => (
  <div class="alert-status-item flex min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3">
    <span
      class="alert-status-icon flex size-9 shrink-0 items-center justify-center rounded-xl"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 12h3l2-5 3 10 2-7 2 4h4" />
      </svg>
    </span>
    <div class="min-w-0">
      <div class="text-[9px] font-medium tracking-[0.12em] text-slate-600 uppercase">
        {props.label}
      </div>
      <div class="mt-1 font-mono text-[11px] break-words text-slate-400">{props.value}</div>
    </div>
  </div>
);

const LoadingCard: Component = () => (
  <div class="pro-panel alerts-card rounded-[28px] border p-6">
    <div class="h-3 w-24 animate-pulse rounded bg-white/[0.055]" />
    <div class="mt-3 h-5 w-56 animate-pulse rounded bg-white/[0.055]" />
    <div class="mt-7 grid gap-4 md:grid-cols-2">
      <div class="h-16 animate-pulse rounded-xl bg-white/[0.035]" />
      <div class="h-16 animate-pulse rounded-xl bg-white/[0.035]" />
    </div>
  </div>
);
