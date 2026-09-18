import type { PlayerView } from '../../api/types';

export function isInternetRadioPlayer(
  player: Pick<PlayerView, 'backend' | 'source'> | undefined,
): boolean {
  return player?.backend === 'mpd' && player.source === 'Інтернет-радіо';
}
