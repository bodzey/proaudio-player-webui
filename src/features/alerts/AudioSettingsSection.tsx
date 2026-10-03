import type { Component } from 'solid-js';

import type { AudioSettings } from '../../api/types';
import { type FormMessage } from './AlertUi';
import { SettingsGroup, SettingsNumber, SettingsRange, SettingsSwitch } from './SettingsFields';
import type { SettingsSection } from './settings-navigation';

interface AudioSettingsSectionProps {
  settings: AudioSettings;
  section: SettingsSection;
  busy: boolean;
  dirty: boolean;
  message: FormMessage | undefined;
  setFormRef: (element: HTMLFormElement) => void;
  onDirty: () => void;
  onSave: () => void;
}

export const AudioSettingsSection: Component<AudioSettingsSectionProps> = (props) => (
  <section class="settings-card">
    <form
      ref={(element) => props.setFormRef(element)}
      class="settings-form"
      novalidate
      aria-busy={props.busy}
      onInput={() => props.onDirty()}
      onChange={() => props.onDirty()}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <fieldset class="settings-form-body" disabled={props.busy}>
        <div hidden={props.section !== 'announcements'}>
          <header class="settings-card-heading">
            <h2>Оповіщення</h2>
            <p>Гучність оголошень і поведінка музики під час повітряної тривоги.</p>
          </header>
          <SettingsSwitch
            name="air_raid_alerts_enabled"
            label="Повітряні тривоги"
            checked={
              props.settings.air_raid_alerts_enabled ?? props.settings.notifications_enabled ?? true
            }
            help="Після вимкнення плеєр завершить активне оповіщення й відновить музику."
          />
          <SettingsGroup title="Звук оголошення">
            <SettingsRange
              name="alert_volume_percent"
              label="Гучність оголошень"
              min={0}
              max={100}
              step={0.1}
              unit="%"
              value={props.settings.alert_volume_percent}
            />
            <SettingsNumber
              name="alert_repeat_interval_minutes"
              label="Повторення оголошення, хв"
              min={0}
              max={1440}
              value={props.settings.alert_repeat_interval_minutes}
              help="0 — відтворювати лише при початку тривоги."
            />
          </SettingsGroup>
          <SettingsGroup title="Музика під час тривоги">
            <SettingsRange
              name="duck_db"
              label="Стишення музики"
              min={-60}
              max={0}
              step={0.1}
              unit="dB"
              value={props.settings.duck_db}
              help="0 dB — без стишення. Від’ємні значення зменшують гучність."
            />
            <SettingsSwitch
              name="duck_only_during_announcement"
              label="Стишувати лише під час оголошення"
              checked={props.settings.duck_only_during_announcement}
              help="Після завершення файла музика відновиться, навіть якщо тривога ще триває."
            />
          </SettingsGroup>
          <details class="settings-advanced">
            <summary>Розширені параметри звуку</summary>
            <SettingsGroup title="Плавні переходи">
              <SettingsNumber
                name="duck_fade_seconds"
                label="Стишення музики, с"
                min={0}
                max={60}
                step="any"
                value={props.settings.duck_fade_seconds}
              />
              <SettingsNumber
                name="restore_fade_seconds"
                label="Відновлення музики, с"
                min={0}
                max={60}
                step="any"
                value={props.settings.restore_fade_seconds}
              />
              <SettingsNumber
                name="default_restore_volume_percent"
                label="Резервна гучність відновлення, %"
                min={0}
                max={100}
                step="any"
                value={props.settings.default_restore_volume_percent}
                help="Застосовується лише за відсутності збереженого попереднього рівня."
              />
            </SettingsGroup>
          </details>
        </div>
        <div hidden={props.section !== 'schedule'}>
          <header class="settings-card-heading">
            <h2>Хвилина мовчання</h2>
            <p>Щоденний запуск за часом, установленим для плеєра.</p>
          </header>
          <SettingsSwitch
            name="minute_silence_enabled"
            label="Щоденна хвилина мовчання"
            checked={props.settings.minute_silence_enabled}
            help="Відтворюється один раз на добу за вказаним розкладом."
          />
          <SettingsGroup title="Розклад">
            <label class="settings-field">
              <span>Час початку</span>
              <input
                class="settings-input"
                name="minute_silence_start_time"
                type="time"
                step="1"
                required
                value={props.settings.minute_silence_start_time}
              />
            </label>
            <label class="settings-field">
              <span>Часовий пояс</span>
              <input
                class="settings-input"
                name="minute_silence_timezone"
                type="text"
                list="minute-silence-timezones"
                required
                spellcheck={false}
                value={props.settings.minute_silence_timezone}
              />
              <datalist id="minute-silence-timezones">
                <option value="Europe/Kyiv" />
                <option value="UTC" />
              </datalist>
              <small>Розклад використовує цей пояс, незалежно від часу на вашому пристрої.</small>
            </label>
            <SettingsRange
              name="minute_silence_volume_percent"
              label="Гучність хвилини мовчання"
              min={0}
              max={100}
              step={0.1}
              unit="%"
              value={props.settings.minute_silence_volume_percent}
              help="Відносно рівня оголошень."
            />
          </SettingsGroup>
          <details class="settings-advanced">
            <summary>Розширені параметри розкладу</summary>
            <SettingsGroup title="Поведінка при запуску">
              <SettingsNumber
                name="minute_silence_catch_up_seconds"
                label="Допустиме запізнення, с"
                min={0}
                max={86400}
                value={props.settings.minute_silence_catch_up_seconds}
              />
              <SettingsNumber
                name="minute_silence_music_fade_seconds"
                label="Стишення перед початком, с"
                min={0}
                max={60}
                step="any"
                value={props.settings.minute_silence_music_fade_seconds}
              />
            </SettingsGroup>
          </details>
        </div>
      </fieldset>
      <footer class="settings-savebar">
        <div
          role="status"
          aria-live="polite"
          classList={{ 'is-error': props.message?.tone === 'error' }}
        >
          <strong>
            {props.busy ? 'Зберігаємо…' : props.dirty ? 'Є незбережені зміни' : 'Зміни збережено'}
          </strong>
          <p>{props.message?.text ?? 'Параметри оповіщень і розкладу зберігаються разом.'}</p>
        </div>
        <button
          type="submit"
          class="settings-primary-button"
          disabled={props.busy || !props.dirty}
          aria-busy={props.busy}
        >
          {props.busy ? 'Збереження…' : 'Зберегти зміни'}
        </button>
      </footer>
    </form>
  </section>
);
