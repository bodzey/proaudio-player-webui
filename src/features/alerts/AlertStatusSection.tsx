import { Show, type Component } from 'solid-js';

import type { AudioSettings, PriorityState } from '../../api/types';
import { formatTimestamp, StatusItem } from './AlertUi';

interface AlertStatusSectionProps {
  priority: PriorityState | undefined;
  audio: AudioSettings | undefined;
}

export const AlertStatusSection: Component<AlertStatusSectionProps> = (props) => (
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
            : props.audio?.air_raid_alerts_enabled === false
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
                : props.audio?.air_raid_alerts_enabled === false
                  ? 'Система вимкнена'
                  : 'Черговий режим'}
          </b>
          <small>
            {props.priority?.active
              ? 'Система виконує сценарій активної тривоги'
              : props.audio?.air_raid_alerts_enabled === false
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
);
