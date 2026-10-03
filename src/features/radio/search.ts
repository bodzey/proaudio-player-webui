import type { RadioStation } from './stations';

export function filterRadioStations(
  stations: readonly RadioStation[],
  query: string,
): readonly RadioStation[] {
  const words = query.trim().toLocaleLowerCase('uk-UA').split(/\s+/).filter(Boolean);
  if (words.length === 0) return stations;
  return stations.filter((station) => {
    const text =
      `${station.name} ${station.shortName} ${station.genre} ${station.description}`.toLocaleLowerCase(
        'uk-UA',
      );
    return words.every((word) => text.includes(word));
  });
}
