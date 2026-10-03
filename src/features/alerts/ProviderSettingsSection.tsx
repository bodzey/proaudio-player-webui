import { Show, type Component } from 'solid-js';

import type { AlertProviderSettings } from '../../api/types';
import { type BusyAction, type FormMessage } from './AlertUi';
import { SettingsGroup, SettingsNumber } from './SettingsFields';

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
  <section class="settings-card">
    <header class="settings-card-heading">
      <h2>Підключення API</h2>
      <p>Локація, для якої плеєр отримує повідомлення про повітряні тривоги.</p>
      <span class="settings-token-status">
        {props.settings.token_configured
          ? 'Токен налаштовано'
          : 'Додайте API-токен для підключення'}
      </span>
    </header>
    <form
      ref={(element) => props.setFormRef(element)}
      class="settings-form"
      novalidate
      aria-busy={props.busy !== null}
      onInput={() => props.onDirty()}
      onChange={() => props.onDirty()}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <fieldset class="settings-form-body" disabled={props.busy !== null}>
        <SettingsGroup title="Локація">
          <SettingsNumber
            name="location_uid"
            label="UID локації"
            min={1}
            max={4294967295}
            value={props.settings.location_uid}
            help="Ідентифікатор локації у сервісі alerts.in.ua."
          />
          <label class="settings-field">
            <span>Тип локації</span>
            <select
              class="settings-input"
              name="location_type"
              value={props.settings.location_type}
            >
              <option value="hromada">Територіальна громада</option>
              <option value="city">Місто</option>
              <option value="raion">Район</option>
              <option value="oblast">Область</option>
              <option value="standalone">Окрема територія</option>
            </select>
          </label>
        </SettingsGroup>
        <SettingsGroup title="Доступ до сервера">
          <label class="settings-field settings-field-wide">
            <span>API-токен</span>
            <div class="settings-token-input">
              <input
                class="settings-input"
                name="token"
                type={props.tokenVisible ? 'text' : 'password'}
                autocomplete="new-password"
                maxlength="4096"
                placeholder="Залиште порожнім, щоб зберегти поточний"
              />
              <button
                type="button"
                class="settings-secondary-button"
                aria-pressed={props.tokenVisible}
                onClick={() => props.onToggleToken()}
              >
                {props.tokenVisible ? 'Приховати' : 'Показати'}
              </button>
            </div>
            <small>Збережений токен не відображається. Порожнє поле не видаляє його.</small>
          </label>
        </SettingsGroup>
        <details class="settings-advanced">
          <summary>Розширені параметри підключення</summary>
          <SettingsGroup title="Сервер і повторні запити">
            <label class="settings-field settings-field-wide">
              <span>Шаблон адреси API</span>
              <input
                class="settings-input"
                name="endpoint"
                type="text"
                inputmode="url"
                spellcheck={false}
                required
                maxlength="2048"
                value={props.settings.endpoint}
              />
              <small>
                Адреса має містити шаблон <code>{'{uid}'}</code>.
              </small>
            </label>
            <SettingsNumber
              name="poll_interval_seconds"
              label="Інтервал перевірки, с"
              min={8}
              max={3600}
              step="any"
              value={props.settings.poll_interval_seconds}
            />
            <SettingsNumber
              name="request_timeout_seconds"
              label="Очікування відповіді, с"
              min={0.1}
              max={120}
              step="any"
              value={props.settings.request_timeout_seconds}
            />
            <SettingsNumber
              name="rate_limit_backoff_seconds"
              label="Пауза після перевищення ліміту, с"
              min={60}
              max={86400}
              step="any"
              value={props.settings.rate_limit_backoff_seconds}
            />
            <SettingsNumber
              name="clear_confirmations"
              label="Підтверджень відбою"
              min={1}
              max={100}
              value={props.settings.clear_confirmations}
            />
          </SettingsGroup>
        </details>
      </fieldset>
      <footer class="settings-savebar">
        <div
          role="status"
          aria-live="polite"
          classList={{ 'is-error': props.message?.tone === 'error' }}
        >
          <strong>
            {props.message?.text ??
              (props.dirty ? 'Є незбережені зміни' : 'Налаштування збережено')}
          </strong>
          <p>Перевірка використовує введені значення й не зберігає їх.</p>
        </div>
        <div class="settings-action-buttons">
          <button
            type="button"
            class="settings-secondary-button"
            disabled={props.busy !== null}
            aria-busy={props.busy === 'test'}
            onClick={() => props.onTest()}
          >
            {props.busy === 'test' ? 'Перевірка…' : 'Перевірити'}
          </button>
          <button
            type="submit"
            class="settings-primary-button"
            disabled={props.busy !== null || !props.dirty}
            aria-busy={props.busy === 'save'}
          >
            {props.busy === 'save' ? 'Збереження…' : 'Зберегти зміни'}
          </button>
        </div>
      </footer>
      <Show when={props.settings.token_configured}>
        <p class="settings-help settings-security-hint">
          Для зміни токена введіть нове значення та збережіть налаштування.
        </p>
      </Show>
    </form>
  </section>
);
