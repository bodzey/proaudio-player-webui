import { For, type Component } from 'solid-js';

import type { AlertMediaKind, AlertMediaResponse } from '../../api/types';
import {
  AlertMediaIcon,
  formatBytes,
  formatMediaTimestamp,
  messageClass,
  type FormMessage,
} from './AlertUi';

interface AlertMediaSectionProps {
  files: AlertMediaResponse;
  busy: AlertMediaKind | undefined;
  resetAll: boolean;
  messages: Partial<Record<AlertMediaKind, FormMessage>>;
  onUpload: (kind: AlertMediaKind, file: File) => void;
  onReset: (kind: AlertMediaKind) => void;
  onResetAll: () => void;
}

export const AlertMediaSection: Component<AlertMediaSectionProps> = (props) => (
  <section class="pro-panel alerts-card alert-media-section rounded-[28px] border">
    <div class="alert-section-heading">
      <div>
        <p class="alert-eyebrow">Файли сповіщень</p>
        <h2>Файли сповіщень</h2>
        <p>
          Власні MP3 зберігаються у постійному сховищі та не губляться після оновлення
          прошивки. Максимальний розмір одного файла — {formatBytes(props.files.max_size_bytes)}.
        </p>
      </div>
      <button
        type="button"
        class="alert-button alert-button-secondary alert-reset-all"
        disabled={props.resetAll || props.busy !== undefined}
        onClick={() => props.onResetAll()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 8.5A8 8 0 1 1 5 16M4.5 8.5V3.8M4.5 8.5h4.7" />
        </svg>
        {props.resetAll ? 'Відновлення…' : 'Відновити стандартні'}
      </button>
    </div>
  
    <div class="alert-media-list">
      <For each={props.files.items}>
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
                class={'alert-media-message ' + messageClass(props.messages[item.kind])}
                role="status"
                aria-live="polite"
              >
                {props.messages[item.kind]?.text ?? ''}
              </span>
            </div>
            <div class="alert-media-actions">
              <label
                class={
                  'alert-button alert-button-primary alert-upload-button' +
                  (props.busy !== undefined || props.resetAll ? ' is-disabled' : '')
                }
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 14v5h16v-5" />
                </svg>
                {props.busy === item.kind ? 'Завантаження…' : 'Обрати MP3'}
                <input
                  class="sr-only"
                  type="file"
                  accept=".mp3,audio/mpeg,audio/mp3"
                  disabled={props.busy !== undefined || props.resetAll}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const selectedFile = input.files?.[0];
                    input.value = '';
                    if (selectedFile) props.onUpload(item.kind, selectedFile);
                  }}
                />
              </label>
              <button
                type="button"
                class="alert-button alert-button-secondary"
                disabled={props.busy !== undefined || props.resetAll}
                onClick={() => props.onReset(item.kind)}
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
);
