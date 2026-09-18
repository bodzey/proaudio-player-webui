import type { Component } from 'solid-js';

import type { ConnectionState } from '../state/player';

interface ConnectionBadgeProps {
  state: ConnectionState;
}

const labels: Record<ConnectionState, string> = {
  connecting: 'Підключення',
  online: 'Підключено',
  reconnecting: 'Перепідключення',
  offline: 'Немає зв’язку',
};

export const ConnectionBadge: Component<ConnectionBadgeProps> = (props) => (
  <span
    class="connection-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
    data-state={props.state}
    role="status"
    aria-live="polite"
  >
    <span class="status-dot h-2 w-2 rounded-full bg-slate-500" />
    {labels[props.state]}
  </span>
);
