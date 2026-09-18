import type { PlayerStatus } from '../../api/types';
import { isInternetRadioPlayer } from '../player/presentation';

export function activeRadioStreamUrl(
  status: Pick<PlayerStatus, 'player' | 'mpd'> | undefined,
): string | null {
  if (!status || !isInternetRadioPlayer(status.player)) return null;
  return status.mpd.stream_url ?? null;
}
