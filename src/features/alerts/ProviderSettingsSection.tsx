import { Show, type Component } from 'solid-js';

import type { AlertProviderSettings } from '../../api/types';
import {
  HELP_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  messageClass,
  type BusyAction,
  type FormMessage,
} from './AlertUi';

interface ProviderSettingsSectionProps {
  settings: AlertProviderSettings;
  busy: BusyAction;
  dirty: boolean;
  message: FormMessage | undefined;
  tokenVisible: boolean;
  setFormRef: (element: HTMLFormElement) => void;
  onDirty: () => void;
  onToggleToken: () => void;
  onSave: () => void;
  onTest: () => void;
}

export const ProviderSettingsSection: Component<ProviderSettingsSectionProps> = (props) => (
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
          props.settings.token_configured
            ? 'alert-token-badge is-configured'
            : 'alert-token-badge'
        }
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9.2 12.8 1.9 1.9 4.3-4.6" />
          <circle cx="12" cy="12" r="8.2" />
        </svg>
        {props.settings.token_configured ? 'Токен налаштовано' : 'Токен відсутній'}
      </div>
    </div>

    <form
      ref={(element) => {
        props.setFormRef(element);
      }}
      class="alert-provider-form"
      aria-busy={props.busy !== null}
      onInput={props.onDirty}
      onChange={props.onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <fieldset class="contents" disabled={props.busy !== null}>
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
              value={props.settings.endpoint}
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
            value={props.settings.location_uid}
          />
          <span class={HELP_CLASS}>Ідентифікатор вашої локації (uid).</span>
        </label>

        <label class={LABEL_CLASS}>
          Тип локації
          <select class={INPUT_CLASS} name="location_type" value={props.settings.location_type}>
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
              type={props.tokenVisible ? 'text' : 'password'}
              autocomplete="new-password"
              maxlength="4096"
              placeholder="Залиште порожнім, щоб не змінювати"
            />
            <button
              type="button"
              class="alert-input-action"
              aria-label={props.tokenVisible ? 'Приховати API-токен' : 'Показати API-токен'}
              title={props.tokenVisible ? 'Приховати API-токен' : 'Показати API-токен'}
              onClick={() => props.onToggleToken()}
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
                Інтервал {props.settings.poll_interval_seconds} с · timeout{' '}
                {props.settings.request_timeout_seconds} с · HTTP 429{' '}
                {props.settings.rate_limit_backoff_seconds} с
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
                value={props.settings.poll_interval_seconds}
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
                value={props.settings.request_timeout_seconds}
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
                value={props.settings.rate_limit_backoff_seconds}
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
                value={props.settings.clear_confirmations}
              />
              <span class={HELP_CLASS}>Кількість послідовних відповідей про відбій.</span>
            </label>
          </div>
        </details>
      </fieldset>

      <div class="alert-form-actions alert-span-full">
        <span
          class={'alert-form-message ' + messageClass(props.message)}
          role="status"
          aria-live="polite"
        >
          <Show when={props.dirty && !props.message?.text}>
            Є незбережені зміни
          </Show>
          {props.message?.text ?? ''}
        </span>
        <div class="alert-action-buttons">
          <button
            type="button"
            class="alert-button alert-button-secondary"
            disabled={props.busy !== null}
            onClick={() => props.onTest()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4.8v5.4h-5.4" />
            </svg>
            {props.busy === 'test' ? 'Перевірка…' : 'Перевірити API'}
          </button>
          <button
            type="submit"
            class="alert-button alert-button-primary"
            disabled={props.busy !== null || !props.dirty}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 3.8h11.5L20 7.3V20H5zM8 3.8V9h8V3.8M8 20v-6h9v6" />
            </svg>
            {props.busy === 'save' ? 'Збереження…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </form>
  </section>
);
