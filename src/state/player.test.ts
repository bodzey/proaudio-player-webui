// @vitest-environment jsdom
import { createRoot } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { api } from '../api/client';
import { demoRequest } from '../api/demo';
import type { PlayerStatus } from '../api/types';
import { createPlayerState } from './player';

vi.mock('../api/events', () => ({ subscribeToStatusEvents: () => () => undefined }));

let dispose: () => void;
let player: ReturnType<typeof createPlayerState>;

beforeEach(() => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  dispose = createRoot((cleanup) => {
    player = createPlayerState();
    return cleanup;
  });
});

afterEach(() => {
  dispose();
  vi.restoreAllMocks();
});

it('shares a status request between background polling and an explicit connection retry', async () => {
  const status = await demoRequest<PlayerStatus>('/status');
  let resolve!: (value: PlayerStatus) => void;
  const request = new Promise<PlayerStatus>((done) => {
    resolve = done;
  });
  const statusRequest = vi.spyOn(api, 'status').mockReturnValue(request);
  const background = player.refresh(false);
  const retry = player.refresh();
  expect(retry).toBe(background);
  expect(statusRequest).toHaveBeenCalledOnce();
  expect(player.refreshing()).toBe(true);
  resolve(status);
  await retry;
  expect(player.refreshing()).toBe(false);
  expect(player.connection()).toBe('online');
  expect(player.status()).toEqual(status);
});

it('reports a failed shared retry and clears its error after a successful attempt', async () => {
  const status = await demoRequest<PlayerStatus>('/status');
  vi.spyOn(api, 'status')
    .mockRejectedValueOnce(new Error('Плеєр недоступний'))
    .mockResolvedValueOnce(status);
  player.refresh(false);
  await player.refresh();
  expect(player.connection()).toBe('offline');
  expect(player.error()).toBe('Плеєр недоступний');
  expect(player.refreshing()).toBe(false);
  await player.refresh();
  expect(player.connection()).toBe('online');
  expect(player.error()).toBeUndefined();
  expect(player.refreshing()).toBe(false);
});
