// @vitest-environment jsdom
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api/client';
import { ConnectionNotice } from '../components/ConnectionNotice';
import { demoRequest } from '../api/demo';
import type {
  AlertMediaResponse,
  AlertProviderSettings,
  AudioSettings,
  PlayerStatus,
} from '../api/types';
import { AlertsPanel } from '../features/alerts/AlertsPanel';
import { MixerStrip } from '../features/mixer/MixerStrip';
import { TransportControls } from '../features/player/TransportControls';
import { RadioPanel } from '../features/radio/RadioPanel';
import { MeterBuffer } from '../realtime/meter-buffer';
import { PageSection } from './PageSection';

vi.mock('../features/mixer/MeterCanvas', () => ({ MeterCanvas: () => null }));

let dispose: (() => void) | undefined;
const mount = (component: () => import('solid-js').JSX.Element) => {
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(component, host);
  return host;
};

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('navigation and commands', () => {
  it('loads a section only on first visit and preserves the draft when returning', () => {
    const [active, setActive] = createSignal(false);
    const host = mount(() => (
      <PageSection active={active()} retain class="page-stage">
        <input aria-label="Draft" />
      </PageSection>
    ));
    expect(host.querySelector('input')).toBeNull();
    setActive(true);
    const input = host.querySelector('input')!;
    input.value = 'draft value';
    setActive(false);
    expect(input.closest('[hidden]')).not.toBeNull();
    setActive(true);
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('draft value');
    expect(input.closest('[hidden]')).toBeNull();
  });

  it('locks every transport command while one is pending and unlocks them afterwards', async () => {
    const player = (await demoRequest<PlayerStatus>('/status')).player;
    const [pending, setPending] = createSignal<import('../api/types').PlayerAction | undefined>(
      'next',
    );
    const onAction = vi.fn();
    const host = mount(() => (
      <TransportControls
        player={player}
        pendingAction={pending()}
        disabled={false}
        onAction={onAction}
      />
    ));
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons.every((button) => button.disabled)).toBe(true);
    buttons.forEach((button) => button.click());
    expect(onAction).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-busy="true"] .ux-spinner')).not.toBeNull();
    setPending(undefined);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    buttons[3]!.click();
    expect(onAction).toHaveBeenCalledExactlyOnceWith('next');
  });

  it('keeps radio searches and the custom URL across page changes', async () => {
    vi.spyOn(api, 'radioStations').mockRejectedValue(new Error('offline'));
    const [active, setActive] = createSignal(true);
    const host = mount(() => (
      <PageSection active={active()} retain class="radio">
        <RadioPanel status={undefined} blocked={false} disabled />
      </PageSection>
    ));
    const search = host.querySelector<HTMLInputElement>('[type="search"]')!;
    const custom = host.querySelector<HTMLInputElement>('[type="url"]')!;
    search.value = 'no such station';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.querySelectorAll('.radio-station-card')).toHaveLength(0);
    expect(host.textContent).toContain('Станцій за цим запитом не знайдено');
    custom.value = 'https://example.org/radio';
    custom.dispatchEvent(new Event('input', { bubbles: true }));
    setActive(false);
    setActive(true);
    expect(search.value).toBe('no such station');
    expect(custom.value).toBe('https://example.org/radio');
    host.querySelector<HTMLButtonElement>('.radio-search button')!.click();
    expect(search.value).toBe('');
    expect(host.querySelectorAll('.radio-station-card').length).toBeGreaterThan(0);
  });

  it('keeps pause feedback visible after the server has already reported a paused player', async () => {
    const player = { ...(await demoRequest<PlayerStatus>('/status')).player, state: 'paused' };
    const host = mount(() => (
      <TransportControls
        player={player}
        pendingAction="pause"
        disabled={false}
        onAction={vi.fn()}
      />
    ));
    expect(host.querySelector('.transport-button--primary .ux-spinner')).not.toBeNull();
  });

  it('offers one connection retry and removes the notice after recovery', () => {
    const [state, setState] = createSignal<import('../state/player').ConnectionState>('offline');
    const [refreshing, setRefreshing] = createSignal(false);
    const onRetry = vi.fn(() => setRefreshing(true));
    const host = mount(() => (
      <ConnectionNotice state={state()} refreshing={refreshing()} onRetry={onRetry} />
    ));
    const button = host.querySelector('button')!;
    button.click();
    button.click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Підключення');
    setState('online');
    expect(host.querySelector('[role="status"]')).toBeNull();
  });
});

describe('mixer interaction safety', () => {
  it('requires focus for wheel changes and ignores keyboard commands after becoming blocked', () => {
    const [blocked, setBlocked] = createSignal(false);
    const onSet = vi.fn();
    const host = mount(() => (
      <MixerStrip
        target="music"
        label="MUSIC"
        level={{ volume: 50, db: -12, muted: false }}
        buffer={new MeterBuffer()}
        blocked={blocked()}
        pending={false}
        detail="Music"
        onSet={onSet}
      />
    ));
    const slider = host.querySelector<HTMLElement>('[role="slider"]')!;
    slider.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(onSet).not.toHaveBeenCalled();
    slider.focus();
    slider.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(onSet).toHaveBeenCalledExactlyOnceWith('music', -11.5);
    setBlocked(true);
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    slider.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(slider.getAttribute('aria-orientation')).toBe('vertical');
  });
});

describe('settings drafts', () => {
  it('keeps edited settings while recovering a failed media request and protects tab closure', async () => {
    vi.spyOn(api, 'alertSettings').mockImplementation(() =>
      demoRequest<AlertProviderSettings>('/settings/alerts'),
    );
    vi.spyOn(api, 'audioSettings').mockImplementation(() =>
      demoRequest<AudioSettings>('/settings/audio'),
    );
    const media = vi
      .spyOn(api, 'alertMedia')
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(() => demoRequest<AlertMediaResponse>('/settings/alerts/media'));
    const [active, setActive] = createSignal(true);
    const host = mount(() => (
      <PageSection active={active()} retain class="alerts">
        <AlertsPanel active={active()} priority={undefined} />
      </PageSection>
    ));
    await vi.waitFor(() => expect(host.querySelector('[name="endpoint"]')).not.toBeNull());
    const input = host.querySelector<HTMLInputElement>('[name="endpoint"]')!;
    input.value = 'https://my-provider.example/{uid}';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    host.querySelector<HTMLButtonElement>('.alert-load-error button')!.click();
    await vi.waitFor(() => expect(host.querySelector('.alert-load-error')).toBeNull());
    expect(media).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[name="endpoint"]')).toBe(input);
    expect(input.value).toBe('https://my-provider.example/{uid}');
    setActive(false);
    await Promise.resolve();
    setActive(true);
    await vi.waitFor(() => expect(media).toHaveBeenCalledTimes(3));
    expect(host.querySelector('[name="endpoint"]')).toBe(input);
    expect(input.value).toBe('https://my-provider.example/{uid}');
  });
});
