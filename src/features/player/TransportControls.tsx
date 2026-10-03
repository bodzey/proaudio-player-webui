import { Show, type Component, type JSX } from 'solid-js';

import type { PlayerAction, PlayerView } from '../../api/types';

interface TransportControlsProps {
  player: PlayerView | undefined;
  pendingAction: PlayerAction | undefined;
  disabled: boolean;
  onAction: (action: PlayerAction) => void;
}

interface TransportButtonProps {
  label: string;
  action: PlayerAction;
  disabled: boolean;
  pending: boolean;
  primary?: boolean | undefined;
  onClick: (action: PlayerAction) => void;
  children: JSX.Element;
}

const TransportButton: Component<TransportButtonProps> = (props) => (
  <button
    type="button"
    class={
      props.primary
        ? 'transport-button transport-button--primary flex size-14 items-center justify-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:size-16 sm:rounded-2xl'
        : 'transport-button flex size-11 items-center justify-center rounded-xl border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:size-12'
    }
    aria-label={props.label}
    title={props.label}
    aria-busy={props.pending}
    disabled={props.disabled || props.pending}
    onClick={() => props.onClick(props.action)}
  >
    <Show
      when={props.pending}
      fallback={
        <svg
          viewBox="0 0 24 24"
          class={props.primary ? 'size-7' : 'size-5'}
          fill="none"
          stroke="currentColor"
          stroke-width={props.primary ? '1.9' : '1.7'}
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          {props.children}
        </svg>
      }
    >
      <span class="ux-spinner" aria-hidden="true" />
    </Show>
  </button>
);

export const TransportControls: Component<TransportControlsProps> = (props) => {
  const playing = () => props.player?.state === 'playing';
  const primaryAction = (): PlayerAction => (playing() ? 'pause' : 'play');
  const controls = () => props.player?.controls;

  return (
    <div
      class="transport-controls mt-5 flex items-center justify-center gap-2 sm:mt-6 sm:gap-3"
      role="group"
      aria-label="Керування відтворенням"
      aria-busy={props.pendingAction !== undefined}
    >
      <TransportButton
        label="Попередній"
        action="prev"
        disabled={props.disabled || props.pendingAction !== undefined || !controls()?.prev}
        pending={props.pendingAction === 'prev'}
        onClick={props.onAction}
      >
        <path d="M6 5v14M18 6l-8 6 8 6V6Z" />
      </TransportButton>

      <TransportButton
        label="Стоп"
        action="stop"
        disabled={props.disabled || props.pendingAction !== undefined || !controls()?.stop}
        pending={props.pendingAction === 'stop'}
        onClick={props.onAction}
      >
        <rect x="7" y="7" width="10" height="10" rx="1" />
      </TransportButton>

      <TransportButton
        primary
        label={playing() ? 'Пауза' : 'Відтворити'}
        action={primaryAction()}
        disabled={
          props.disabled ||
          props.pendingAction !== undefined ||
          (playing() ? !controls()?.pause : !controls()?.play)
        }
        pending={props.pendingAction === 'play' || props.pendingAction === 'pause'}
        onClick={props.onAction}
      >
        <Show when={playing()} fallback={<path d="m9 7 8 5-8 5V7Z" />}>
          <path d="M9 7v10M15 7v10" />
        </Show>
      </TransportButton>

      <TransportButton
        label="Наступний"
        action="next"
        disabled={props.disabled || props.pendingAction !== undefined || !controls()?.next}
        pending={props.pendingAction === 'next'}
        onClick={props.onAction}
      >
        <path d="M18 5v14M6 6l8 6-8 6V6Z" />
      </TransportButton>
    </div>
  );
};
