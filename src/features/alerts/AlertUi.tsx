import { Show, type Component } from 'solid-js';

import type { AlertMediaKind } from '../../api/types';

export type BusyAction = 'save' | 'test' | null;
export type MessageTone = 'success' | 'error' | 'neutral';

export interface FormMessage {
  tone: MessageTone;
  text: string;
}

export const INPUT_CLASS =
  'alert-input mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-sky-300/30 focus:bg-black/30';
export const LABEL_CLASS = 'alert-field text-xs font-medium text-slate-400';
export const HELP_CLASS = 'alert-help mt-1.5 block text-[10px] leading-4 text-slate-600';

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Невідома помилка';
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

export function formatMediaTimestamp(value: number | null): string {
  return value === null ? '—' : new Date(value * 1000).toLocaleString('uk-UA');
}

export function formatBytes(value: number | null): string {
  if (value === null) return '—';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function messageClass(message: FormMessage | undefined): string {
  if (message?.tone === 'error') {
    return 'text-red-300';
  }
  if (message?.tone === 'success') {
    return 'text-emerald-300';
  }
  return 'text-slate-500';
}

type StatusIconKind = 'mode' | 'api' | 'change' | 'location';

interface StatusItemProps {
  kind: StatusIconKind;
  label: string;
  value: string;
}

export const StatusItem: Component<StatusItemProps> = (props) => (
  <div class="alert-status-item">
    <span class="alert-status-icon" aria-hidden="true">
      <StatusIcon kind={props.kind} />
    </span>
    <div>
      <span class="alert-status-label">{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  </div>
);

const StatusIcon: Component<{ kind: StatusIconKind }> = (props) => (
  <>
    <Show when={props.kind === 'api'}>
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.3" />
        <path d="M12 7v5l3 2" />
      </svg>
    </Show>
    <Show when={props.kind === 'change'}>
      <svg viewBox="0 0 24 24">
        <path d="M19 8a7.5 7.5 0 1 0 .5 7M19 8V3.8M19 8h-4.2" />
      </svg>
    </Show>
    <Show when={props.kind === 'location'}>
      <svg viewBox="0 0 24 24">
        <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    </Show>
    <Show when={props.kind === 'mode'}>
      <svg viewBox="0 0 24 24">
        <path d="M4 12h3l2-5 3 10 2-7 2 4h4" />
      </svg>
    </Show>
  </>
);

export const AlertMediaIcon: Component<{ kind: AlertMediaKind }> = (props) => (
  <>
    <Show when={props.kind === 'minute_silence'}>
      <svg viewBox="0 0 24 24">
        <path d="M9 4h6v4l2 2v9H7v-9l2-2zM9 14h6" />
      </svg>
    </Show>
    <Show when={props.kind !== 'minute_silence'}>
      <svg viewBox="0 0 24 24">
        <path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 6.5-2.5 8h17c0-1.5-2.5-2-2.5-8M10 20h4" />
      </svg>
    </Show>
  </>
);

export const LoadingCard: Component = () => (
  <div class="pro-panel alerts-card alert-loading-card rounded-[28px] border">
    <div class="alert-loading-line short" />
    <div class="alert-loading-line title" />
    <div class="alert-loading-grid">
      <div />
      <div />
      <div />
      <div />
    </div>
  </div>
);
