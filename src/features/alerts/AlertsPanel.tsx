import { Show, createSignal, onMount, type Component } from 'solid-js';

import { api } from '../../api/client';
import type {
  AlertMediaFile,
  AlertMediaKind,
  AlertMediaResponse,
  AlertProviderSettings,
  AudioSettings,
  PriorityState,
} from '../../api/types';
import { AlertMediaSection } from './AlertMediaSection';
import { AlertStatusSection } from './AlertStatusSection';
import { errorText, formatBytes, LoadingCard, type BusyAction, type FormMessage } from './AlertUi';
import { AudioSettingsSection } from './AudioSettingsSection';
import { audioPayload, providerPayload } from './form';
import { ProviderSettingsSection } from './ProviderSettingsSection';

interface AlertsPanelProps {
  priority: PriorityState | undefined;
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
      <AlertStatusSection priority={props.priority} audio={audio()} />

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
          <ProviderSettingsSection
            settings={settings}
            busy={providerBusy()}
            dirty={providerDirty()}
            message={providerMessage()}
            tokenVisible={tokenVisible()}
            setFormRef={(element) => {
              providerForm = element;
            }}
            onDirty={markProviderDirty}
            onToggleToken={() => setTokenVisible((value) => !value)}
            onSave={() => void saveProvider()}
            onTest={() => void testProvider()}
          />
        )}
      </Show>

      <Show when={media()} keyed>
        {(files) => (
          <AlertMediaSection
            files={files}
            busy={mediaBusy()}
            resetAll={mediaResetAll()}
            messages={mediaMessages()}
            onUpload={(kind, file) => void uploadMedia(kind, file)}
            onReset={(kind) => void resetMedia(kind)}
            onResetAll={() => void resetAllMedia()}
          />
        )}
      </Show>

      <Show when={audio()} keyed>
        {(settings) => (
          <AudioSettingsSection
            settings={settings}
            busy={audioBusy()}
            dirty={audioDirty()}
            message={audioMessage()}
            setFormRef={(element) => {
              audioForm = element;
            }}
            onDirty={markAudioDirty}
            onSave={() => void saveAudio()}
          />
        )}
      </Show>
    </div>
  );
};
