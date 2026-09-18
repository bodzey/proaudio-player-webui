import { createSignal } from 'solid-js';

import { api } from '../../api/client';
import type { RadioDirectoryStation } from '../../api/types';
import { RADIO_STATIONS, type RadioStation, isSameRadioStream } from './stations';

const [catalog, setCatalog] = createSignal<readonly RadioStation[]>(RADIO_STATIONS);
let loading: Promise<void> | null = null;

function shortName(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (words.length === 0) return 'RADIO';
  if (words.length === 1) return words[0]!.slice(0, 8).toUpperCase();

  const initials = words
    .filter((word) => !/^fm$/i.test(word))
    .map((word) => word[0])
    .join('')
    .slice(0, 6)
    .toUpperCase();

  return initials || words[0]!.slice(0, 8).toUpperCase();
}

function fallbackArtwork(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const accent = (hue + 42) % 360;
  return `linear-gradient(145deg, hsl(${hue} 68% 42%) 0%, hsl(${accent} 66% 34%) 58%, #0b1115 100%)`;
}

function quality(station: RadioDirectoryStation): string {
  const parts = [
    station.codec?.trim().toUpperCase() || null,
    station.bitrate && station.bitrate > 0 ? `${station.bitrate} kbps` : null,
  ].filter(Boolean);
  return parts.join(' • ') || 'STREAM';
}

function genre(station: RadioDirectoryStation): string {
  const tags = station.tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 2);
  return tags.length > 0 ? tags.join(' / ') : 'Internet Radio';
}

function fromDirectory(station: RadioDirectoryStation): RadioStation {
  return {
    id: station.id,
    name: station.name,
    shortName: shortName(station.name),
    genre: genre(station),
    description: station.homepage ? 'Онлайн-радіостанція' : 'Інтернет-радіо',
    quality: quality(station),
    url: station.url,
    artwork: fallbackArtwork(station.id),
    favicon: station.favicon,
    homepage: station.homepage,
  };
}

export const radioStations = catalog;

export async function refreshRadioStations(): Promise<void> {
  if (loading) return loading;

  loading = (async () => {
    try {
      const response = await api.radioStations();
      const items = response.items.map(fromDirectory);
      if (items.length > 0) setCatalog(items);
    } catch {
      // Keep the bundled fallback catalog when the public directory is unavailable.
    } finally {
      loading = null;
    }
  })();

  return loading;
}

export function findCatalogRadioStation(
  url: string | null | undefined,
): RadioStation | undefined {
  if (!url) return undefined;
  return catalog().find((station) => isSameRadioStream(url, station.url));
}
