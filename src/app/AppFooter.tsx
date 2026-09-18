import type { Component } from 'solid-js';

interface AppFooterProps {
  firmware: string;
  firmwareBuildId?: string | undefined;
  playerVersion: string;
  nativeSha?: string | undefined;
}

export const AppFooter: Component<AppFooterProps> = (props) => (
  <footer class="app-footer flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-white/[0.06] text-[9px] tracking-[0.08em] text-slate-500 uppercase sm:text-[10px]">
    <span title={props.firmwareBuildId}>{props.firmware}</span>
    <span title={props.nativeSha}>{props.playerVersion}</span>
  </footer>
);
