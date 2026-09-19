import { Show, type Component } from 'solid-js';

import type { RadioStation } from '../radio/stations';
import { StationArtwork } from '../radio/StationArtwork';

interface PlayerArtworkProps {
  radio: boolean;
  station: RadioStation | undefined;
  stationName: string;
  artUrl: string | null | undefined;
  source: string | undefined;
}

export const PlayerArtwork: Component<PlayerArtworkProps> = (props) => (
  <figure class="player-art relative aspect-[16/10] overflow-hidden bg-[#090c11] sm:aspect-[16/9] lg:aspect-auto">
    <Show
      when={props.radio}
      fallback={
        <Show
          when={props.artUrl}
          fallback={
            <div class="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.16),transparent_42%),linear-gradient(145deg,#111722,#080b10)]">
              <div class="flex size-24 items-center justify-center rounded-[26px] border border-white/10 bg-white/[0.035] shadow-2xl sm:size-28 sm:rounded-[30px]">
                <svg
                  viewBox="0 0 24 24"
                  class="size-10 text-slate-500 sm:size-12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  aria-hidden="true"
                >
                  <path d="M9 18V5l10-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="16" cy="16" r="3" />
                </svg>
              </div>
            </div>
          }
        >
          {(url) => <img src={url()} alt="" class="absolute inset-0 size-full object-cover" />}
        </Show>
      }
    >
      <StationArtwork
        station={props.station}
        fallbackName={props.stationName}
        class="absolute inset-0 size-full"
      />
    </Show>

    <div
      class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent sm:h-32"
      aria-hidden="true"
    />
    <figcaption class="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-3 sm:right-4 sm:bottom-4 sm:left-4">
      <span class="rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-[10px] font-bold tracking-[0.12em] text-white/80 uppercase backdrop-blur-xl sm:rounded-full sm:px-3 sm:text-[11px]">
        {props.source ?? 'Без джерела'}
      </span>
    </figcaption>
  </figure>
);
