// @vitest-environment jsdom
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api/client';
import { demoRequest } from '../../api/demo';
import type { AlertMediaResponse, AlertProviderSettings, AudioSettings } from '../../api/types';
import { AlertsPanel } from './AlertsPanel';

let dispose: (() => void) | undefined;

beforeEach(() => {
  vi.spyOn(api, 'alertSettings').mockImplementation(() =>
    demoRequest<AlertProviderSettings>('/settings/alerts'),
  );
  vi.spyOn(api, 'audioSettings').mockImplementation(async () => ({
    ...(await demoRequest<AudioSettings>('/settings/audio')),
    duck_fade_seconds: 0.25,
  }));
  vi.spyOn(api, 'alertMedia').mockImplementation(() =>
    demoRequest<AlertMediaResponse>('/settings/alerts/media'),
  );
});

afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(() => <AlertsPanel active priority={undefined} />, host);
  await vi.waitFor(() => expect(host.querySelector('[name="duck_db"]')).not.toBeNull());
  return host;
}

function edit(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('settings categories', () => {
  it('retains exact audio values and tokens across categories without applying changes', async () => {
    const save = vi.spyOn(api, 'setAudioSettings');
    const saveProvider = vi.spyOn(api, 'setAlertSettings');
    const host = await mount();
    const gain = host.querySelector<HTMLInputElement>('[name="duck_db"]')!;
    edit(gain, '-12.25');
    host.querySelector<HTMLButtonElement>('#settings-tab-provider')!.click();
    const token = host.querySelector<HTMLInputElement>('[name="token"]')!;
    edit(token, 'draft-token');
    host.querySelector<HTMLButtonElement>('#settings-tab-schedule')!.click();
    const time = host.querySelector<HTMLInputElement>('[name="minute_silence_start_time"]')!;
    edit(time, '10:25:50');
    host.querySelector<HTMLButtonElement>('#settings-tab-announcements')!.click();
    expect(host.querySelector('[name="duck_db"]')).toBe(gain);
    expect(gain.value).toBe('-12.25');
    expect(token.value).toBe('draft-token');
    expect(time.value).toBe('10:25:50');
    expect(save).not.toHaveBeenCalled();
    expect(saveProvider).not.toHaveBeenCalled();
  });

  it('reveals and focuses an invalid field in a closed category before sending a request', async () => {
    const save = vi.spyOn(api, 'setAudioSettings');
    const host = await mount();
    const field = host.querySelector<HTMLInputElement>('[name="minute_silence_catch_up_seconds"]')!;
    edit(field, '86401');
    const form = field.form!;
    expect(
      [...form.querySelectorAll('input:invalid')].map((input) => input.getAttribute('name')),
    ).toEqual(['minute_silence_catch_up_seconds']);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('#settings-tab-schedule')?.getAttribute('aria-current')).toBe('page');
    expect(field.closest('[hidden]')).toBeNull();
    expect(field.closest('details')?.open).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  it('saves both audio categories together and preserves precise server values', async () => {
    const saved = await demoRequest<AudioSettings>('/settings/audio');
    const save = vi.spyOn(api, 'setAudioSettings').mockResolvedValue(saved);
    const host = await mount();
    edit(host.querySelector<HTMLInputElement>('[name="alert_volume_percent"]')!, '73.25');
    const form = host.querySelector<HTMLInputElement>('[name="alert_volume_percent"]')!.form!;
    expect(
      [...form.querySelectorAll('input:invalid')].map((input) => input.getAttribute('name')),
    ).toEqual([]);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      alert_volume_percent: 73.25,
      duck_fade_seconds: 0.25,
      minute_silence_start_time: saved.minute_silence_start_time,
      minute_silence_enabled: saved.minute_silence_enabled,
    });
  });
});
