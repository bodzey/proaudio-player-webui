import { Show, type Component } from 'solid-js';

import type { PriorityState } from '../api/types';

interface PriorityBannerProps {
  priority?: PriorityState;
}

export const PriorityBanner: Component<PriorityBannerProps> = (props) => (
  <Show when={props.priority?.active}>
    <section
      class="mb-5 flex flex-col gap-3 rounded-2xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3.5 shadow-[0_18px_60px_-36px_rgba(248,113,113,0.7)] sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div class="flex items-center gap-3">
        <span class="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-400/10">
          <span class="absolute size-2.5 animate-ping rounded-full bg-red-400/50" />
          <span class="relative size-2.5 rounded-full bg-red-400" />
        </span>
        <div>
          <p class="text-sm font-semibold text-red-100">
            {props.priority?.minute_silence_active ? 'Хвилина мовчання' : 'Пріоритетне оповіщення'}
          </p>
          <p class="mt-0.5 text-xs text-red-200/60">
            {props.priority?.blocking
              ? 'Керування музичним потоком тимчасово заблоковано.'
              : 'Музика працює в режимі talk-over.'}
          </p>
        </div>
      </div>
      <span class="w-fit rounded-lg border border-red-300/10 bg-black/15 px-2.5 py-1 font-mono text-[11px] text-red-100/70 uppercase">
        {props.priority?.mode ?? 'alert'}
      </span>
    </section>
  </Show>
);
