import { RADIO_STATIONS } from '../features/radio/stations';
import type { RadioDirectoryResponse, RadioDirectoryStation } from './types';

const RADIO_BROWSER_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
] as const;

const DIRECTORY_LIMIT = 64;
const REQUEST_TIMEOUT_MS = 8000;

let cachedDirectory: RadioDirectoryResponse | undefined;

function cleanHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stationFromRemote(value: unknown): RadioDirectoryStation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const id = typeof record.stationuuid === 'string' ? record.stationuuid.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim().replace(/\s+/g, ' ') : '';
  const url = cleanHttpUrl(record.url_resolved);
  if (!id || !name || !url) return undefined;

  const tags =
    typeof record.tags === 'string'
      ? record.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];

  const codec =
    typeof record.codec === 'string' && record.codec.trim() ? record.codec.trim() : null;
  const bitrate = finiteNumber(record.bitrate);

  return {
    id,
    name,
    url,
    homepage: cleanHttpUrl(record.homepage),
    favicon: cleanHttpUrl(record.favicon),
    tags,
    codec,
    bitrate: bitrate > 0 ? bitrate : null,
    votes: Math.max(0, finiteNumber(record.votes)),
  };
}

function bundledDirectory(): RadioDirectoryResponse {
  return {
    source: 'bundled-demo',
    items: RADIO_STATIONS.map((station, index) => ({
      id: station.id,
      name: station.name,
      url: station.url,
      homepage: station.homepage ?? null,
      favicon: station.favicon ?? null,
      tags: station.genre
        .split('/')
        .map((tag) => tag.trim())
        .filter(Boolean),
      codec: station.quality === 'HD' ? null : station.quality.split(/\s+/)[0] || null,
      bitrate: null,
      votes: RADIO_STATIONS.length - index,
    })),
  };
}

async function fetchMirror(base: string): Promise<RadioDirectoryResponse | undefined> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({
      countrycode: 'UA',
      hidebroken: 'true',
      order: 'votes',
      reverse: 'true',
      limit: '120',
    });
    const response = await fetch(`${base}/json/stations/search?${query.toString()}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) return undefined;

    const items = payload
      .map(stationFromRemote)
      .filter((station): station is RadioDirectoryStation => station !== undefined)
      .sort(
        (left, right) =>
          right.votes - left.votes ||
          Number(Boolean(right.favicon)) - Number(Boolean(left.favicon)) ||
          (right.bitrate ?? 0) - (left.bitrate ?? 0) ||
          left.name.localeCompare(right.name, 'uk'),
      );

    const names = new Set<string>();
    const unique = items.filter((station) => {
      const key = station.name.toLocaleLowerCase('uk-UA').replace(/\s+/g, ' ');
      if (names.has(key)) return false;
      names.add(key);
      return true;
    });

    if (unique.length === 0) return undefined;
    return { source: 'radio-browser', items: unique.slice(0, DIRECTORY_LIMIT) };
  } catch {
    return undefined;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function demoRadioDirectory(): Promise<RadioDirectoryResponse> {
  if (cachedDirectory) return structuredClone(cachedDirectory);

  for (const server of RADIO_BROWSER_SERVERS) {
    const directory = await fetchMirror(server);
    if (directory) {
      cachedDirectory = directory;
      return structuredClone(directory);
    }
  }

  return bundledDirectory();
}

export function resetDemoRadioDirectoryCache(): void {
  cachedDirectory = undefined;
}
