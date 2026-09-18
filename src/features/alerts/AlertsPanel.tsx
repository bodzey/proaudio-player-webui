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
  'alert-input mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-sky-300/30 focus:bg-black/30';
const LABEL_CLASS = 'alert-field text-xs font-medium text-slate-400';
const HELP_CLASS = 'alert-help mt-1.5 block text-[10px] leading-4 text-slate-600';

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
  const [providerDirty, setProviderDirty] = createSignal(false);
  const [audioDirty, setAudioDirty] = createSignal(false);
  const [tokenVisible, setTokenVisible] = createSignal(false);
  const [mediaResetAll, setMediaResetAll] = createSignal(false);
  const [mediaBusy, setMediaBusy] = createSignal<AlertMediaKind>();
  const [mediaMessages, setMediaMessages] = createSignal<
    Partial<Record<AlertMediaKind, FormMessage>>
  >({});

  let providerForm!: HTMLFormElement;
  let audioForm!: HTMLFormElement;

  function markProviderDirty(): void {
    setProviderDirty(true);
    setProviderMessage(undefined);
  }

  function markAudioDirty(): void {
    setAudioDirty(true);
    setAudioMessage(undefined);
  }

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
      setProviderDirty(false);
    } else {
      errors.push(`API тривог: ${errorText(providerResult.reason)}`);
    }
    if (audioResult.status === 'fulfilled') {
      setAudio(audioResult.value);
      setAudioDirty(false);
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
      setProviderDirty(false);
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
      setAudioDirty(false);
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

  async function resetAllMedia(): Promise<void> {
    const files = media();
    if (!files || mediaResetAll() || mediaBusy() !== undefined) return;
    if (!window.confirm('Відновити заводські файли для всіх трьох сповіщень?')) return;

    setMediaResetAll(true);
    try {
      for (const item of files.items) {
        setMediaMessage(item.kind, { tone: 'neutral', text: 'Відновлення…' });
        const next = await api.resetAlertMedia(item.kind);
        updateMediaFile(next);
        setMediaMessage(item.kind, { tone: 'success', text: 'Заводський файл відновлено.' });
      }
    } catch (error) {
      const text = errorText(error);
      for (const item of files.items) {
        setMediaMessage(item.kind, { tone: 'error', text });
      }
    } finally {
      setMediaResetAll(false);
    }
  }

  onMount(() => {
    void loadSettings();
  });

  return (
    <div class="alerts-page alerts-v2 space-y-5">
      <section class="pro-panel alerts-card alert-overview-card rounded-[28px] border">
        <div class="alert-section-heading">
          <div>
            <p class="alert-eyebrow">Стан системи</p>
            <h2>Стан системи тривог</h2>
            <p>Поточний статус роботи системи оповіщень та останні події.</p>
          </div>
          <div
            class={
              props.priority?.active
                ? 'alert-duty-badge is-active'
                : audio()?.air_raid_alerts_enabled === false
                  ? 'alert-duty-badge is-disabled'
                  : 'alert-duty-badge'
            }
          >
            <span class="alert-duty-dot" />
            <span>
              <b>
                {props.priority?.minute_silence_active
                  ? 'Хвилина мовчання'
                  : props.priority?.active
                    ? 'Тривога активна'
                    : audio()?.air_raid_alerts_enabled === false
                      ? 'Система вимкнена'
                      : 'Черговий режим'}
              </b>
              <small>
                {props.priority?.active
                  ? 'Система виконує сценарій активної тривоги'
                  : audio()?.air_raid_alerts_enabled === false
                    ? 'Опитування alerts.in.ua вимкнено'
                    : 'Система працює у штатному режимі'}
              </small>
            </span>
          </div>
        </div>

        <div class="alert-status-grid">
          <StatusItem kind="mode" label="Режим" value={props.priority?.mode ?? '—'} />
          <StatusItem
            kind="api"
            label="Остання відповідь API"
            value={formatTimestamp(props.priority?.last_success_at)}
          />
          <StatusItem
            kind="change"
            label="Остання зміна"
            value={formatTimestamp(props.priority?.last_change_at)}
          />
          <StatusItem
            kind="location"
            label="UID у тривозі"
            value={
              props.priority?.matched_uids?.length ? props.priority.matched_uids.join(', ') : '—'
            }
          />
        </div>

        <Show when={props.priority?.last_error}>
          {(lastError) => (
            <div class="alert-inline-error" role="alert">
              <span class="alert-inline-error-dot" />
              <span>{lastError()}</span>
            </div>
          )}
        </Show>
      </section>

      <Show when={loadError()}>
        {(error) => (
          <div class="alert-load-error" role="alert">
            <span>Не вдалося завантажити частину налаштувань: {error()}</span>
            <button type="button" onClick={() => void loadSettings()}>
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
          <section class="pro-panel alerts-card alert-api-card rounded-[28px] border">
            <div class="alert-section-heading">
              <div>
                <p class="alert-eyebrow">API налаштування</p>
                <h2>API повітряних тривог</h2>
                <p>
                  Налаштування підключення до сервера alerts.in.ua. Перевірка API використовує
                  введені значення, але не зберігає їх.
                </p>
              </div>
              <div
                class={
                  settings.token_configured
                    ? 'alert-token-badge is-configured'
                    : 'alert-token-badge'
                }
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9.2 12.8 1.9 1.9 4.3-4.6" />
                  <circle cx="12" cy="12" r="8.2" />
                </svg>
                {settings.token_configured ? 'Токен налаштовано' : 'Токен відсутній'}
              </div>
            </div>

            <form
              ref={(element) => {
                providerForm = element;
              }}
              class="alert-provider-form"
              aria-busy={providerBusy() !== null}
              onInput={markProviderDirty}
              onChange={markProviderDirty}
              onSubmit={(event) => {
                event.preventDefault();
                void saveProvider();
              }}
            >
              <fieldset class="contents" disabled={providerBusy() !== null}>
                <label class={LABEL_CLASS + ' alert-span-full'}>
                  Шаблон адреси API
                  <div class="alert-input-shell has-leading-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M10.4 13.6 13.6 10.4M8.1 15.9l-1.3 1.3a3.2 3.2 0 0 1-4.5-4.5l3.2-3.2A3.2 3.2 0 0 1 10 9M15.9 8.1l1.3-1.3a3.2 3.2 0 0 1 4.5 4.5l-3.2 3.2A3.2 3.2 0 0 1 14 15" />
                    </svg>
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
                  </div>
                  <span class={HELP_CLASS}>
                    Адреса повинна містити <code>{'{uid}'}</code>.
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
                  <span class={HELP_CLASS}>Ідентифікатор вашої локації (uid).</span>
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
                  <span class={HELP_CLASS}>Оберіть тип вашої локації.</span>
                </label>

                <label class={LABEL_CLASS + ' alert-span-full'}>
                  Новий API-токен
                  <div class="alert-input-shell has-trailing-action">
                    <input
                      class={INPUT_CLASS}
                      name="token"
                      type={tokenVisible() ? 'text' : 'password'}
                      autocomplete="new-password"
                      maxlength="4096"
                      placeholder="Залиште порожнім, щоб не змінювати"
                    />
                    <button
                      type="button"
                      class="alert-input-action"
                      aria-label={tokenVisible() ? 'Приховати API-токен' : 'Показати API-токен'}
                      title={tokenVisible() ? 'Приховати API-токен' : 'Показати API-токен'}
                      onClick={() => setTokenVisible((value) => !value)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.8 12s3.2-5.2 9.2-5.2S21.2 12 21.2 12 18 17.2 12 17.2 2.8 12 2.8 12Z" />
                        <circle cx="12" cy="12" r="2.2" />
                      </svg>
                    </button>
                  </div>
                  <span class={HELP_CLASS}>Залиште порожнім, щоб не змінювати поточний токен.</span>
                </label>

                <details class="alert-advanced alert-span-full">
                  <summary>
                    <span>
                      <b>Розширені параметри API</b>
                      <small>
                        Інтервал {settings.poll_interval_seconds} с · timeout{' '}
                        {settings.request_timeout_seconds} с · HTTP 429{' '}
                        {settings.rate_limit_backoff_seconds} с
                      </small>
                    </span>
                  </summary>
                  <div class="alert-provider-timing">
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
                      <span class={HELP_CLASS}>Як часто перевіряти стан тривог.</span>
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
                      <span class={HELP_CLASS}>Скільки чекати на відповідь сервера.</span>
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
                      <span class={HELP_CLASS}>Затримка після перевищення ліміту.</span>
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
                      <span class={HELP_CLASS}>Кількість послідовних відповідей про відбій.</span>
                    </label>
                  </div>
                </details>
              </fieldset>

              <div class="alert-form-actions alert-span-full">
                <span
                  class={'alert-form-message ' + messageClass(providerMessage())}
                  role="status"
                  aria-live="polite"
                >
                  <Show when={providerDirty() && !providerMessage()?.text}>
                    Є незбережені зміни
                  </Show>
                  {providerMessage()?.text ?? ''}
                </span>
                <div class="alert-action-buttons">
                  <button
                    type="button"
                    class="alert-button alert-button-secondary"
                    disabled={providerBusy() !== null}
                    onClick={() => void testProvider()}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4.8v5.4h-5.4" />
                    </svg>
                    {providerBusy() === 'test' ? 'Перевірка…' : 'Перевірити API'}
                  </button>
                  <button
                    type="submit"
                    class="alert-button alert-button-primary"
                    disabled={providerBusy() !== null || !providerDirty()}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 3.8h11.5L20 7.3V20H5zM8 3.8V9h8V3.8M8 20v-6h9v6" />
                    </svg>
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
          <section class="pro-panel alerts-card alert-media-section rounded-[28px] border">
            <div class="alert-section-heading">
              <div>
                <p class="alert-eyebrow">Файли сповіщень</p>
                <h2>Файли сповіщень</h2>
                <p>
                  Власні MP3 зберігаються у постійному сховищі та не губляться після оновлення
                  прошивки. Максимальний розмір одного файла — {formatBytes(files.max_size_bytes)}.
                </p>
              </div>
              <button
                type="button"
                class="alert-button alert-button-secondary alert-reset-all"
                disabled={mediaResetAll() || mediaBusy() !== undefined}
                onClick={() => void resetAllMedia()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4.5 8.5A8 8 0 1 1 5 16M4.5 8.5V3.8M4.5 8.5h4.7" />
                </svg>
                {mediaResetAll() ? 'Відновлення…' : 'Відновити стандартні'}
              </button>
            </div>

            <div class="alert-media-list">
              <For each={files.items}>
                {(item) => (
                  <article class={'alert-media-card alert-media-row is-' + item.kind}>
                    <div class="alert-media-icon">
                      <AlertMediaIcon kind={item.kind} />
                    </div>
                    <div class="alert-media-copy">
                      <div class="alert-media-title-row">
                        <div>
                          <h3>{item.label}</h3>
                          <p>{item.file_name}</p>
                        </div>
                        <span
                          class={
                            item.configured ? 'alert-ready-badge' : 'alert-ready-badge is-missing'
                          }
                        >
                          {item.configured ? 'Готово' : 'Відсутній'}
                        </span>
                      </div>
                      <dl class="alert-media-meta">
                        <div>
                          <dt>Розмір</dt>
                          <dd>{formatBytes(item.size_bytes)}</dd>
                        </div>
                        <div>
                          <dt>Оновлено</dt>
                          <dd>{formatMediaTimestamp(item.modified_unix_seconds)}</dd>
                        </div>
                      </dl>
                      <span
                        class={'alert-media-message ' + messageClass(mediaMessages()[item.kind])}
                        role="status"
                        aria-live="polite"
                      >
                        {mediaMessages()[item.kind]?.text ?? ''}
                      </span>
                    </div>
                    <div class="alert-media-actions">
                      <label
                        class={
                          'alert-button alert-button-primary alert-upload-button' +
                          (mediaBusy() !== undefined || mediaResetAll() ? ' is-disabled' : '')
                        }
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 14v5h16v-5" />
                        </svg>
                        {mediaBusy() === item.kind ? 'Завантаження…' : 'Обрати MP3'}
                        <input
                          class="sr-only"
                          type="file"
                          accept=".mp3,audio/mpeg,audio/mp3"
                          disabled={mediaBusy() !== undefined || mediaResetAll()}
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const selectedFile = input.files?.[0];
                            input.value = '';
                            if (selectedFile) void uploadMedia(item.kind, selectedFile);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        class="alert-button alert-button-secondary"
                        disabled={mediaBusy() !== undefined || mediaResetAll()}
                        onClick={() => void resetMedia(item.kind)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 8.5A8 8 0 1 1 5.5 16M5 8.5V4M5 8.5h4.5" />
                        </svg>
                        Відновити
                      </button>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </section>
        )}
      </Show>

      <Show when={audio()} keyed>
        {(settings) => (
          <section class="pro-panel alerts-card alert-audio-section rounded-[28px] border">
            <div class="alert-section-heading">
              <div>
                <p class="alert-eyebrow">Налаштування аудіо</p>
                <h2>Поведінка звуку під час тривоги</h2>
                <p>
                  Ducking, часові параметри та хвилина мовчання. Рівень повідомлень ALERT задається
                  одним фейдером у мікшері автоматично.
                </p>
              </div>
            </div>

            <form
              ref={(element) => {
                audioForm = element;
              }}
              class="alert-audio-form"
              aria-busy={audioBusy()}
              onInput={markAudioDirty}
              onChange={markAudioDirty}
              onSubmit={(event) => {
                event.preventDefault();
                void saveAudio();
              }}
            >
              <fieldset class="contents" disabled={audioBusy()}>
                <div class="alert-config-group alert-switch-group">
                  <div class="alert-config-title">
                    <span class="alert-config-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 12h2M18 12h2M8 7v10M16 7v10M12 4v16" />
                      </svg>
                    </span>
                    <div>
                      <h3>Основні перемикачі</h3>
                      <p>Незалежне керування тривогами та щоденною хвилиною мовчання.</p>
                    </div>
                  </div>

                  <div class="alert-switch-grid">
                    <label class="alert-switch-row">
                      <input
                        name="air_raid_alerts_enabled"
                        type="checkbox"
                        checked={
                          settings.air_raid_alerts_enabled ?? settings.notifications_enabled ?? true
                        }
                      />
                      <span class="alert-switch-control" aria-hidden="true">
                        <span />
                      </span>
                      <span class="alert-switch-copy">
                        <b>Увімкнути систему оповіщень</b>
                        <small>
                          Якщо вимкнути, плеєр припинить опитування API, завершить активне
                          сповіщення та відновить попередній рівень звуку.
                        </small>
                      </span>
                    </label>

                    <label class="alert-switch-row">
                      <input
                        name="minute_silence_enabled"
                        type="checkbox"
                        checked={settings.minute_silence_enabled}
                      />
                      <span class="alert-switch-control" aria-hidden="true">
                        <span />
                      </span>
                      <span class="alert-switch-copy">
                        <b>Увімкнути хвилину мовчання</b>
                        <small>
                          Запуск виконується один раз на добу за вказаним локальним часом.
                        </small>
                      </span>
                    </label>
                  </div>
                </div>

                <div class="alert-config-group">
                  <div class="alert-config-title with-chip">
                    <span class="alert-config-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 5v14M17 5v14M4 9h6M14 15h6" />
                      </svg>
                    </span>
                    <div>
                      <h3>Приглушення музики</h3>
                      <p>Рівень та швидкість зниження музики під час системного оголошення.</p>
                    </div>
                  </div>
                  <div class="alert-config-fields two-cols">
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
                      <span class={HELP_CLASS}>На скільки зменшити гучність.</span>
                    </label>
                    <label class={LABEL_CLASS}>
                      Плавне стишення, с
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
                      <span class={HELP_CLASS}>Час, за який музика досягне цільового рівня.</span>
                    </label>
                  </div>

                  <label class="alert-behavior-check">
                    <input
                      name="duck_only_during_announcement"
                      type="checkbox"
                      checked={settings.duck_only_during_announcement}
                    />
                    <span class="alert-check-box" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="m6.5 12.5 3.2 3.2 7.8-8" />
                      </svg>
                    </span>
                    <span>
                      <b>Приглушувати лише під час оголошення</b>
                      <small>
                        Після завершення аудіофайлу музика повертається до попереднього рівня,
                        навіть якщо тривога ще триває.
                      </small>
                    </span>
                  </label>
                </div>

                <div class="alert-config-group">
                  <div class="alert-config-title">
                    <span class="alert-config-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="8.2" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                    </span>
                    <div>
                      <h3>Хвилина мовчання</h3>
                      <p>Час запуску, часовий пояс, допустиме запізнення та рівні відтворення.</p>
                    </div>
                  </div>
                  <div class="alert-config-fields minute-grid">
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

                    <label class={LABEL_CLASS + ' alert-field-wide'}>
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
                      <span class={HELP_CLASS}>Відносно рівня ALERT у мікшері.</span>
                    </label>

                    <label class={LABEL_CLASS + ' alert-field-wide'}>
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
                      <span class={HELP_CLASS}>
                        Використовується, якщо немає збереженого рівня.
                      </span>
                    </label>
                  </div>
                </div>

                <div class="alert-config-group">
                  <div class="alert-config-title">
                    <span class="alert-config-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12a7 7 0 1 0 2-5M5 5v5h5" />
                      </svg>
                    </span>
                    <div>
                      <h3>Відновлення</h3>
                      <p>Повернення музики після завершення повідомлення або хвилини мовчання.</p>
                    </div>
                  </div>
                  <div class="alert-config-fields two-cols">
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
                      <span class={HELP_CLASS}>Плавне повернення до попереднього рівня.</span>
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
                      <span class={HELP_CLASS}>0 — не повторювати оголошення.</span>
                    </label>
                  </div>
                </div>
              </fieldset>

              <div
                class="alert-audio-savebar"
                classList={{ 'is-dirty': audioDirty() || audioBusy() }}
              >
                <div>
                  <span class="alert-savebar-icon" aria-hidden="true">
                    i
                  </span>
                  <span>
                    <b>{audioDirty() ? 'Є незбережені зміни' : 'Налаштування готові'}</b>
                    <small>
                      {audioMessage()?.text ??
                        'Після збереження всі параметри почнуть діяти одразу.'}
                    </small>
                  </span>
                </div>
                <button
                  type="submit"
                  class="alert-button alert-button-primary alert-save-audio"
                  disabled={audioBusy() || !audioDirty()}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 3.8h11.5L20 7.3V20H5zM8 3.8V9h8V3.8M8 20v-6h9v6" />
                  </svg>
                  {audioBusy() ? 'Збереження…' : 'Зберегти налаштування'}
                </button>
              </div>
            </form>
          </section>
        )}
      </Show>
    </div>
  );
};

type StatusIconKind = 'mode' | 'api' | 'change' | 'location';

interface StatusItemProps {
  kind: StatusIconKind;
  label: string;
  value: string;
}

const StatusItem: Component<StatusItemProps> = (props) => (
  <div class="alert-status-item">
    <span class="alert-status-icon" aria-hidden="true">
      <StatusIcon kind={props.kind} />
    </span>
    <div>
      <span class="alert-status-label">{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  </div>
);

const StatusIcon: Component<{ kind: StatusIconKind }> = (props) => (
  <>
    <Show when={props.kind === 'api'}>
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.3" />
        <path d="M12 7v5l3 2" />
      </svg>
    </Show>
    <Show when={props.kind === 'change'}>
      <svg viewBox="0 0 24 24">
        <path d="M19 8a7.5 7.5 0 1 0 .5 7M19 8V3.8M19 8h-4.2" />
      </svg>
    </Show>
    <Show when={props.kind === 'location'}>
      <svg viewBox="0 0 24 24">
        <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    </Show>
    <Show when={props.kind === 'mode'}>
      <svg viewBox="0 0 24 24">
        <path d="M4 12h3l2-5 3 10 2-7 2 4h4" />
      </svg>
    </Show>
  </>
);

const AlertMediaIcon: Component<{ kind: AlertMediaKind }> = (props) => (
  <>
    <Show when={props.kind === 'minute_silence'}>
      <svg viewBox="0 0 24 24">
        <path d="M9 4h6v4l2 2v9H7v-9l2-2zM9 14h6" />
      </svg>
    </Show>
    <Show when={props.kind !== 'minute_silence'}>
      <svg viewBox="0 0 24 24">
        <path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 6.5-2.5 8h17c0-1.5-2.5-2-2.5-8M10 20h4" />
      </svg>
    </Show>
  </>
);

const LoadingCard: Component = () => (
  <div class="pro-panel alerts-card alert-loading-card rounded-[28px] border">
    <div class="alert-loading-line short" />
    <div class="alert-loading-line title" />
    <div class="alert-loading-grid">
      <div />
      <div />
      <div />
      <div />
    </div>
  </div>
);
