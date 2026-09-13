import { type Component } from 'solid-js';

import type { RadioStation } from './stations';

interface StationArtworkProps {
  station: RadioStation | undefined;
  fallbackName?: string | undefined;
  class?: string | undefined;
  compact?: boolean | undefined;
}

export const StationArtwork: Component<StationArtworkProps> = (props) => {
  const name = () => props.station?.name ?? props.fallbackName ?? 'Internet Radio';
  const shortName = () => props.station?.shortName ?? name().slice(0, 8).toUpperCase();
  const background = () =>
    props.station?.artwork ?? 'linear-gradient(145deg, #0f172a 0%, #1e293b 52%, #020617 100%)';

  return (
    <div
      class={`relative overflow-hidden ${props.class ?? ''}`}
      style={{ background: background() }}
      role="img"
      aria-label={`Обкладинка ${name()}`}
    >
      <div class="absolute -top-12 -right-8 size-40 rounded-full border border-white/10 bg-white/[0.06]" />
      <div class="absolute -bottom-20 -left-12 size-52 rounded-full border border-white/10 bg-black/10" />
      <div class="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.08),transparent_35%,rgba(0,0,0,0.18))]" />
      <div class="relative flex size-full flex-col justify-between p-5 sm:p-6">
        <div class="flex items-center gap-2 text-[9px] font-semibold tracking-[0.2em] text-white/55 uppercase">
          <span class="size-1.5 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.7)]" />
          Радіоефір
        </div>
        <div>
          <div
            class={
              props.compact
                ? 'text-xl font-black tracking-[-0.05em] text-white'
                : 'text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl'
            }
          >
            {shortName()}
          </div>
          <div class="mt-2 truncate text-[10px] font-semibold tracking-[0.12em] text-white/55 uppercase">
            {name()}
          </div>
        </div>
      </div>
    </div>
  );
};
