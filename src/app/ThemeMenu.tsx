import { For, Show, createSignal, onCleanup, onMount, type Component } from 'solid-js';

import type { ThemeMode } from '../state/theme';

interface ThemeMenuProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}

const OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Система' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
];

export const ThemeMenu: Component<ThemeMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;
  let trigger!: HTMLButtonElement;
  const optionElements: HTMLButtonElement[] = [];

  const currentLabel = () =>
    OPTIONS.find((option) => option.value === props.value)?.label ?? 'Тема';

  const selectedIndex = () =>
    Math.max(
      0,
      OPTIONS.findIndex((option) => option.value === props.value),
    );

  const focusOption = (index: number) => {
    const normalized = (index + OPTIONS.length) % OPTIONS.length;
    optionElements[normalized]?.focus();
  };

  const openAndFocus = (index: number) => {
    setOpen(true);
    queueMicrotask(() => focusOption(index));
  };

  const choose = (value: ThemeMode) => {
    props.onChange(value);
    setOpen(false);
    queueMicrotask(() => trigger.focus());
  };

  const onMenuKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(OPTIONS.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        trigger.focus();
        break;
      default:
        break;
    }
  };

  onMount(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!root.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !open()) return;
      setOpen(false);
      trigger.focus();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    });
  });

  return (
    <div
      ref={(element) => {
        root = element;
      }}
      class="theme-control"
    >
      <button
        ref={(element) => {
          trigger = element;
        }}
        type="button"
        class="theme-button"
        aria-label="Тема інтерфейсу"
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openAndFocus(selectedIndex());
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openAndFocus(selectedIndex() - 1);
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          class="theme-button-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        <span>{currentLabel()}</span>
        <svg
          viewBox="0 0 20 20"
          class="theme-chevron"
          classList={{ 'is-open': open() }}
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>

      <Show when={open()}>
        <div class="theme-menu" role="menu" aria-label="Тема інтерфейсу">
          <p class="theme-menu-label">Тема інтерфейсу</p>
          <For each={OPTIONS}>
            {(option, index) => (
              <button
                ref={(element) => {
                  optionElements[index()] = element;
                }}
                type="button"
                class="theme-option"
                classList={{ 'is-selected': props.value === option.value }}
                role="menuitemradio"
                aria-checked={props.value === option.value}
                tabIndex={props.value === option.value ? 0 : -1}
                onKeyDown={(event) => onMenuKeyDown(event, index())}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                <span class="theme-option-radio" aria-hidden="true">
                  <span />
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
