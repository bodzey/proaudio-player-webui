import type { AlertProviderUpdate, AudioSettingsUpdate } from '../../api/types';

function formString(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function formNumber(data: FormData, name: string): number {
  const raw = formString(data, name);
  if (!raw) {
    throw new Error(`Не заповнено числове поле: ${name}`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Некоректне числове значення: ${name}`);
  }
  return value;
}

export function providerPayload(data: FormData): AlertProviderUpdate {
  const payload: AlertProviderUpdate = {
    endpoint: formString(data, 'endpoint'),
    location_uid: formNumber(data, 'location_uid'),
    location_type: formString(data, 'location_type'),
    poll_interval_seconds: formNumber(data, 'poll_interval_seconds'),
    request_timeout_seconds: formNumber(data, 'request_timeout_seconds'),
    rate_limit_backoff_seconds: formNumber(data, 'rate_limit_backoff_seconds'),
    clear_confirmations: formNumber(data, 'clear_confirmations'),
  };
  const token = formString(data, 'token');
  if (token) {
    payload.token = token;
  }
  return payload;
}

export function audioPayload(data: FormData): AudioSettingsUpdate {
  const airRaidAlertsEnabled = data.get('air_raid_alerts_enabled') === 'on';
  return {
    air_raid_alerts_enabled: airRaidAlertsEnabled,
    notifications_enabled: airRaidAlertsEnabled,
    duck_db: formNumber(data, 'duck_db'),
    minute_silence_volume_percent: formNumber(data, 'minute_silence_volume_percent'),
    minute_silence_enabled: data.get('minute_silence_enabled') === 'on',
    minute_silence_start_time: formString(data, 'minute_silence_start_time'),
    minute_silence_timezone: formString(data, 'minute_silence_timezone'),
    minute_silence_catch_up_seconds: formNumber(data, 'minute_silence_catch_up_seconds'),
    minute_silence_music_fade_seconds: formNumber(data, 'minute_silence_music_fade_seconds'),
    default_restore_volume_percent: formNumber(data, 'default_restore_volume_percent'),
    duck_fade_seconds: formNumber(data, 'duck_fade_seconds'),
    restore_fade_seconds: formNumber(data, 'restore_fade_seconds'),
    alert_repeat_interval_minutes: formNumber(data, 'alert_repeat_interval_minutes'),
    duck_only_during_announcement: data.get('duck_only_during_announcement') === 'on',
  };
}
