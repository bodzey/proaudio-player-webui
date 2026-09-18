import type { Component } from 'solid-js';

import type { AudioSettings } from '../../api/types';
import { HELP_CLASS, INPUT_CLASS, LABEL_CLASS, type FormMessage } from './AlertUi';

interface AudioSettingsSectionProps {
  settings: AudioSettings;
  busy: boolean;
  dirty: boolean;
  message: FormMessage | undefined;
  setFormRef: (element: HTMLFormElement) => void;
  onDirty: () => void;
  onSave: () => void;
}

export const AudioSettingsSection: Component<AudioSettingsSectionProps> = (props) => (
  <section class="pro-panel alerts-card alert-audio-section rounded-[28px] border">
    <div class="alert-section-heading">
      <div>
        <p class="alert-eyebrow">Налаштування аудіо</p>
        <h2>Поведінка звуку під час тривоги</h2>
        <p>
          Ducking, часові параметри та хвилина мовчання. Рівень повідомлень ALERT задається одним
          фейдером у мікшері автоматично.
        </p>
      </div>
    </div>

    <form
      ref={(element) => {
        props.setFormRef(element);
      }}
      class="alert-audio-form"
      aria-busy={props.busy}
      onInput={() => props.onDirty()}
      onChange={() => props.onDirty()}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <fieldset class="contents" disabled={props.busy}>
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
                  props.settings.air_raid_alerts_enabled ??
                  props.settings.notifications_enabled ??
                  true
                }
              />
              <span class="alert-switch-control" aria-hidden="true">
                <span />
              </span>
              <span class="alert-switch-copy">
                <b>Увімкнути систему оповіщень</b>
                <small>
                  Якщо вимкнути, плеєр припинить опитування API, завершить активне сповіщення та
                  відновить попередній рівень звуку.
                </small>
              </span>
            </label>

            <label class="alert-switch-row">
              <input
                name="minute_silence_enabled"
                type="checkbox"
                checked={props.settings.minute_silence_enabled}
              />
              <span class="alert-switch-control" aria-hidden="true">
                <span />
              </span>
              <span class="alert-switch-copy">
                <b>Увімкнути хвилину мовчання</b>
                <small>Запуск виконується один раз на добу за вказаним локальним часом.</small>
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
                value={props.settings.duck_db}
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
                value={props.settings.duck_fade_seconds}
              />
              <span class={HELP_CLASS}>Час, за який музика досягне цільового рівня.</span>
            </label>
          </div>

          <label class="alert-behavior-check">
            <input
              name="duck_only_during_announcement"
              type="checkbox"
              checked={props.settings.duck_only_during_announcement}
            />
            <span class="alert-check-box" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m6.5 12.5 3.2 3.2 7.8-8" />
              </svg>
            </span>
            <span>
              <b>Приглушувати лише під час оголошення</b>
              <small>
                Після завершення аудіофайлу музика повертається до попереднього рівня, навіть якщо
                тривога ще триває.
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
                value={props.settings.minute_silence_start_time}
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
                value={props.settings.minute_silence_timezone}
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
                value={props.settings.minute_silence_catch_up_seconds}
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
                value={props.settings.minute_silence_music_fade_seconds}
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
                value={props.settings.minute_silence_volume_percent}
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
                value={props.settings.default_restore_volume_percent}
              />
              <span class={HELP_CLASS}>Використовується, якщо немає збереженого рівня.</span>
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
                value={props.settings.restore_fade_seconds}
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
                value={props.settings.alert_repeat_interval_minutes}
              />
              <span class={HELP_CLASS}>0 — не повторювати оголошення.</span>
            </label>
          </div>
        </div>
      </fieldset>

      <div class="alert-audio-savebar" classList={{ 'is-dirty': props.dirty || props.busy }}>
        <div>
          <span class="alert-savebar-icon" aria-hidden="true">
            i
          </span>
          <span>
            <b>{props.dirty ? 'Є незбережені зміни' : 'Налаштування готові'}</b>
            <small>
              {props.message?.text ?? 'Після збереження всі параметри почнуть діяти одразу.'}
            </small>
          </span>
        </div>
        <button
          type="submit"
          class="alert-button alert-button-primary alert-save-audio"
          disabled={props.busy || !props.dirty}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 3.8h11.5L20 7.3V20H5zM8 3.8V9h8V3.8M8 20v-6h9v6" />
          </svg>
          {props.busy ? 'Збереження…' : 'Зберегти налаштування'}
        </button>
      </div>
    </form>
  </section>
);
