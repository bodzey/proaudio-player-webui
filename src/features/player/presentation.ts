import type { PlayerView } from '../../api/types';

export function isInternetRadioPlayer(
  player: Pick<PlayerView, 'backend' | 'source'> | undefined,
): boolean {
  return player?.backend === 'mpd' && player.source === 'Інтернет-радіо';
}

export function formatClock(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—:—';

  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA').replace(/\s+/g, ' ');
}

function sameText(left: string, right: string): boolean {
  return Boolean(left && right && normalizedText(left) === normalizedText(right));
}

export function radioTrackMetadata(
  titleValue: string | null | undefined,
  artistValue: string | null | undefined,
  stationName: string,
): { title: string; artist: string } {
  let title = titleValue?.trim() ?? '';
  let artist = artistValue?.trim() ?? '';

  if (sameText(title, stationName)) title = '';
  if (sameText(artist, stationName)) artist = '';

  if (title && !artist) {
    const separator = title.indexOf(' - ');
    if (separator > 0 && separator < title.length - 3) {
      artist = title.slice(0, separator).trim();
      title = title.slice(separator + 3).trim();
    }
  }

  return { title, artist };
}
