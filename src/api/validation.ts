import type { AudioLevel, PlayerStatus } from './types';

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nullableFinite(value: unknown): boolean {
  return value === null || finite(value);
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function audioLevel(value: unknown): value is AudioLevel {
  const item = record(value);
  return Boolean(item && finite(item.volume) && finite(item.db) && typeof item.muted === 'boolean');
}

function nullableAudioLevel(value: unknown): boolean {
  return value === null || audioLevel(value);
}

/** Validate the untrusted JSON boundary before it reaches reactive UI state. */
export function parsePlayerStatus(value: unknown): PlayerStatus | undefined {
  const root = record(value);
  const priority = record(root?.priority);
  const mpd = record(root?.mpd);
  const levels = record(root?.audio_levels);
  const player = record(root?.player);
  const controls = record(player?.controls);
  const sources = root?.sources;

  if (
    !root ||
    typeof root.name !== 'string' ||
    !finite(root.volume) ||
    root.volume < 0 ||
    root.volume > 100 ||
    typeof root.muted !== 'boolean' ||
    !priority ||
    typeof priority.mode !== 'string' ||
    typeof priority.active !== 'boolean' ||
    typeof priority.blocking !== 'boolean' ||
    typeof priority.duck_only_during_announcement !== 'boolean' ||
    typeof priority.minute_silence_active !== 'boolean' ||
    !Array.isArray(priority.matched_uids) ||
    !priority.matched_uids.every((uid) => Number.isInteger(uid) && uid >= 0) ||
    !nullableString(priority.last_success_at) ||
    !nullableString(priority.last_change_at) ||
    !nullableString(priority.last_error) ||
    !mpd ||
    !Array.isArray(sources) ||
    !sources.every((source) => {
      const item = record(source);
      return Boolean(
        item &&
        typeof item.key === 'string' &&
        typeof item.active === 'boolean' &&
        typeof item.type === 'string' &&
        typeof item.application === 'string' &&
        typeof item.media === 'string',
      );
    }) ||
    !levels ||
    !finite(levels.music_bus) ||
    !nullableAudioLevel(levels.master) ||
    !nullableAudioLevel(levels.physical) ||
    !nullableAudioLevel(levels.hardware) ||
    !nullableAudioLevel(levels.alert_bus) ||
    !player ||
    typeof player.source !== 'string' ||
    typeof player.backend !== 'string' ||
    typeof player.state !== 'string' ||
    typeof player.title !== 'string' ||
    typeof player.artist !== 'string' ||
    typeof player.album !== 'string' ||
    !nullableString(player.art_url) ||
    !nullableFinite(player.position_seconds) ||
    !nullableFinite(player.duration_seconds) ||
    !nullableString(player.elapsed) ||
    !nullableString(player.duration) ||
    !finite(player.progress) ||
    !controls ||
    !['play', 'pause', 'stop', 'next', 'prev'].every(
      (action) => typeof controls[action] === 'boolean',
    )
  ) {
    return undefined;
  }

  return value as PlayerStatus;
}
