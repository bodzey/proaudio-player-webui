import { Show, createSignal, onMount, type Component } from 'solid-js';

import { api } from '../../api/client';
import type {
  AlertProviderSettings,
  AlertProviderUpdate,
  AudioSettings,
  AudioSettingsUpdate,
  PriorityState,
} from '../../api/types';

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

function formString(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function formNumber(data: FormData, name: string): number {
  const value = Number(formString(data, name));
  if (!Number.isFinite(value)) {
    throw new Error(`Некоректне числове значення: ${name}`);
  }
  return value;
}

function providerPayload(form: HTMLFormElement): AlertProviderUpdate {
  const data = new FormData(form);
  const payload: AlertProviderUpdate = {
    endpoint: formString(data, 'endpoint'),
    location_uid: formNumber(data, 'location_uid'),
    location_type: formString(data, 'location_type'),
    poll_interval_seconds: formNumber(data, 'poll_interval_seconds'),
    request_timeout_seconds: formNumber(data, 'request_timeout_seconds'),
    rate_limit_backoff_seconds: formNumber(data, 'rate_limit_backoff_seconds'),
    clear_confirmations: formNumber(data, 'clear_confirmations'),
  };
  const token = formString(data, 'token');
  if (token) {
    payload.token = token;
  }
  return payload;
}

function audioPayload(form: HTMLFormElement): AudioSettingsUpdate {
  const data = new FormData(form);
  return {
    duck_db: formNumber(data, 'duck_db'),
    minute_silence_volume_percent: formNumber(data, 'minute_silence_volume_percent'),
    default_restore_volume_percent: formNumber(data, 'default_restore_volume_percent'),
    duck_fade_seconds: formNumber(data, 'duck_fade_seconds'),
    restore_fade_seconds: formNumber(data, 'restore_fade_seconds'),
    alert_repeat_interval_minutes: formNumber(data, 'alert_repeat_interval_minutes'),
    duck_only_during_announcement: data.get('duck_only_during_announcement') === 'on',
  };
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
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
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string>();
  const [providerBusy, setProviderBusy] = createSignal<BusyAction>(null);
  const [audioBusy, setAudioBusy] = createSignal(false);
  const [providerMessage, setProviderMessage] = createSignal<FormMessage>();
  const [audioMessage, setAudioMessage] = createSignal<FormMessage>();

  let providerForm!: HTMLFormElement;
  let audioForm!: HTMLFormElement;

  async function loadSettings(): Promise<void> {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [nextProvider, nextAudio] = await Promise.all([
        api.alertSettings(),
        api.audioSettings(),
      ]);
      setProvider(nextProvider);
      setAudio(nextAudio);
    } catch (error) {
      setLoadError(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveProvider(): Promise<void> {
    if (!providerForm.reportValidity()) {
      return;
    }
    setProviderBusy('save');
    setProviderMessage({ tone: 'neutral', text: 'Збереження…' });
    try {
      const next = await api.setAlertSettings(providerPayload(providerForm));
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
    setProviderBusy('test');
    setProviderMessage({ tone: 'neutral', text: 'Перевірка API…' });
    try {
      const result = await api.testAlertSettings(providerPayload(providerForm));
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
    setAudioBusy(true);
    setAudioMessage({ tone: 'neutral', text: 'Збереження…' });
    try {
      const next = await api.setAudioSettings(audioPayload(audioForm));
      setAudio(next);
      setAudioMessage({ tone: 'success', text: 'Параметри оповіщень збережено.' });
    } catch (error) {
      setAudioMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setAudioBusy(false);
    }
  }

  onMount(() => {
    void loadSettings();
  });

  return (
    <div class="space-y-5">
      <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Оповіщення
            </p>
            <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
              Стан системи тривог
            </h2>
          </div>
          <div
            class={
              props.priority?.active
                ? 'flex w-fit items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-3 py-2 text-xs font-medium text-red-200'
                : 'flex w-fit items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-xs font-medium text-emerald-200/80'
            }
          >
            <span
              class={
                props.priority?.active
                  ? 'size-2 rounded-full bg-red-400'
                  : 'size-2 rounded-full bg-emerald-400/70'
              }
            />
            {props.priority?.minute_silence_active
              ? 'Хвилина мовчання'
              : props.priority?.active
                ? 'Тривога активна'
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
          <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 sm:p-6">
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
              onSubmit={(event) => {
                event.preventDefault();
                void saveProvider();
              }}
            >
              <label class={`${LABEL_CLASS} md:col-span-2`}>
                Шаблон адреси API
                <input
                  class={INPUT_CLASS}
                  name="endpoint"
                  type="text"
                  inputmode="url"
                  spellcheck={false}
                  required
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
                  min="1"
                  step="1"
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
                  step="1"
                  required
                  value={settings.clear_confirmations}
                />
              </label>

              <div class="flex flex-col gap-3 border-t border-white/[0.055] pt-5 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
                <span class={`min-h-5 text-xs ${messageClass(providerMessage())}`} role="status">
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

      <Show when={audio()} keyed>
        {(settings) => (
          <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 sm:p-6">
            <div>
              <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                Alert audio
              </p>
              <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
                Поведінка звуку під час тривоги
              </h2>
              <p class="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
                Ducking, часові параметри та хвилина мовчання. Рівень повідомлень ALERT
                задається одним фейдером у мікшері та зберігається автоматично.
              </p>
            </div>

            <form
              ref={(element) => {
                audioForm = element;
              }}
              class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveAudio();
              }}
            >
              <label class={LABEL_CLASS}>
                Стишення музики, dB
                <input
                  class={INPUT_CLASS}
                  name="duck_db"
                  type="number"
                  min="-60"
                  max="0"
                  step="1"
                  required
                  value={settings.duck_db}
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
                  max="30"
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
                  max="30"
                  step="0.1"
                  required
                  value={settings.restore_fade_seconds}
                />
              </label>

              <label class={LABEL_CLASS}>
                Повторення активної тривоги
                <select
                  class={INPUT_CLASS}
                  name="alert_repeat_interval_minutes"
                  value={settings.alert_repeat_interval_minutes}
                >
                  <option value="0">Не повторювати</option>
                  <option value="5">Кожні 5 хвилин</option>
                  <option value="10">Кожні 10 хвилин</option>
                  <option value="15">Кожні 15 хвилин</option>
                  <option value="30">Кожні 30 хвилин</option>
                  <option value="60">Щогодини</option>
                </select>
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
                    Після аудіофайлу музика повертається до попереднього рівня, навіть якщо тривога
                    триває.
                  </span>
                </span>
              </label>

              <div class="flex flex-col gap-3 border-t border-white/[0.055] pt-5 sm:flex-row sm:items-center sm:justify-between md:col-span-2 xl:col-span-3">
                <span class={`min-h-5 text-xs ${messageClass(audioMessage())}`} role="status">
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
  <div class="rounded-2xl border border-white/[0.055] bg-black/15 px-3.5 py-3">
    <div class="text-[9px] font-medium tracking-[0.12em] text-slate-600 uppercase">
      {props.label}
    </div>
    <div class="mt-1.5 font-mono text-[11px] break-words text-slate-400">{props.value}</div>
  </div>
);

const LoadingCard: Component = () => (
  <div class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-6">
    <div class="h-3 w-24 animate-pulse rounded bg-white/[0.055]" />
    <div class="mt-3 h-5 w-56 animate-pulse rounded bg-white/[0.055]" />
    <div class="mt-7 grid gap-4 md:grid-cols-2">
      <div class="h-16 animate-pulse rounded-xl bg-white/[0.035]" />
      <div class="h-16 animate-pulse rounded-xl bg-white/[0.035]" />
    </div>
  </div>
);
