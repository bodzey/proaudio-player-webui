import type { Component } from 'solid-js';

import type { ConnectionState } from '../state/player';

interface ConnectionBadgeProps {
  state: ConnectionState;
}

const labels: Record<ConnectionState, string> = {
  connecting: 'Підключення',
  online: 'Online',
  reconnecting: 'Перепідключення',
  offline: 'Offline',
};

export const ConnectionBadge: Component<ConnectionBadgeProps> = (props) => (
  <span
    class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
    data-state={props.state}
  >
    <span class="status-dot h-2 w-2 rounded-full bg-slate-500" />
    {labels[props.state]}
  </span>
);
