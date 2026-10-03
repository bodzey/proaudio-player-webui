import { Show, type Component } from 'solid-js';

import type { ConnectionState } from '../state/player';

interface ConnectionNoticeProps {
  state: ConnectionState;
  refreshing: boolean;
  onRetry: () => void;
}

const titles: Record<Exclude<ConnectionState, 'online'>, string> = {
  connecting: 'Підключаємося до плеєра',
  reconnecting: 'Відновлюємо зв’язок',
  offline: 'Плеєр недоступний',
};

export const ConnectionNotice: Component<ConnectionNoticeProps> = (props) => (
  <Show when={props.state !== 'online'}>
    <div class="connection-notice" role="status" aria-live="polite">
      <div>
        <strong>{titles[props.state as Exclude<ConnectionState, 'online'>]}</strong>
        <p>
          {props.state === 'offline'
            ? 'Перевірте живлення плеєра та підключення до тієї самої мережі. Зв’язок відновиться автоматично.'
            : 'Дочекайтеся актуального стану плеєра. Повторно відкривати сторінку не потрібно.'}
        </p>
      </div>
      <button
        type="button"
        class="ux-button"
        disabled={props.refreshing}
        aria-busy={props.refreshing}
        onClick={() => props.onRetry()}
      >
        {props.refreshing ? 'Підключення…' : 'Повторити підключення'}
      </button>
    </div>
  </Show>
);
