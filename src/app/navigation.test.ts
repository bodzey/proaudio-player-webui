import { describe, expect, it } from 'vitest';

import { pageFromHash } from './navigation';

describe('pageFromHash', () => {
  it('maps known section hashes and falls back to the player', () => {
    expect(pageFromHash('#player')).toBe('player');
    expect(pageFromHash('#radio')).toBe('radio');
    expect(pageFromHash('#settings')).toBe('settings');
    expect(pageFromHash('#alerts')).toBe('settings');
    expect(pageFromHash('')).toBe('player');
    expect(pageFromHash('#unknown')).toBe('player');
  });
});
