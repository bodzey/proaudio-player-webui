export type SettingsSection = 'announcements' | 'schedule' | 'provider' | 'media';

export const SETTINGS_SECTIONS: readonly {
  id: SettingsSection;
  title: string;
  description: string;
}[] = [
  { id: 'announcements', title: 'Оповіщення', description: 'Гучність і поведінка музики' },
  { id: 'schedule', title: 'Хвилина мовчання', description: 'Розклад і рівень відтворення' },
  { id: 'provider', title: 'Підключення API', description: 'Локація та доступ до сервера' },
  { id: 'media', title: 'Звукові файли', description: 'Оголошення та їх відновлення' },
];

export function sectionForAudioField(name: string): SettingsSection {
  return name.startsWith('minute_silence_') ? 'schedule' : 'announcements';
}

/** Reveal a hidden settings group before the browser focuses an invalid field. */
export function validateSettingsForm(
  form: HTMLFormElement,
  reveal: (field: string) => void,
): boolean {
  if (form.checkValidity()) return true;
  const invalid = form.querySelector<HTMLInputElement | HTMLSelectElement>(
    'input:invalid, select:invalid',
  );
  if (invalid) {
    reveal(invalid.name);
    let ancestor = invalid.parentElement;
    while (ancestor && ancestor !== form) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    invalid.focus();
    invalid.reportValidity();
  }
  return false;
}
