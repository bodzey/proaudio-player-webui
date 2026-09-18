import { Show, type Component, type JSX } from 'solid-js';

import type { AppPage } from './navigation';

interface PrimaryNavProps {
  page: AppPage;
  alertActive: boolean;
}

interface NavLinkProps {
  page: AppPage;
  current: AppPage;
  children: JSX.Element;
}

const NavLink: Component<NavLinkProps> = (props) => (
  <a
    href={`#${props.page}`}
    class={
      props.current === props.page
        ? 'nav-button nav-button--active flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[11px] font-semibold sm:min-h-11 sm:px-3'
        : 'nav-button flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-transparent px-2 py-2 text-[11px] font-medium transition sm:min-h-11 sm:px-3'
    }
    aria-current={props.current === props.page ? 'page' : undefined}
  >
    {props.children}
  </a>
);

export const PrimaryNav: Component<PrimaryNavProps> = (props) => (
  <nav
    class="app-nav pro-nav mb-4 grid grid-cols-3 gap-1 rounded-xl border p-1 sm:mb-5"
    aria-label="Основні розділи"
  >
    <NavLink page="player" current={props.page}>
      <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
        <path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l9.5-6.4a1 1 0 0 0 0-1.7l-9.5-6.4A1 1 0 0 0 8 5.6Z" />
      </svg>
      <span class="nav-button-label">Плеєр</span>
    </NavLink>

    <NavLink page="radio" current={props.page}>
      <svg
        viewBox="0 0 24 24"
        class="size-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3.5" y="7" width="17" height="12" rx="2" />
        <path d="m7 7 9-4M7.5 12h.01M7.5 15h.01M11 12h5.5M11 15h5.5" />
      </svg>
      <span class="nav-button-label">Радіо</span>
    </NavLink>

    <NavLink page="alerts" current={props.page}>
      <svg
        viewBox="0 0 24 24"
        class="size-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      <span class="nav-button-label">Оповіщення</span>
      <Show when={props.alertActive}>
        <span class="nav-alert-dot size-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.65)]" />
      </Show>
    </NavLink>
  </nav>
);
