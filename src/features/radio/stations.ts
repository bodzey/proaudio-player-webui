export interface RadioStation {
  id: string;
  name: string;
  shortName: string;
  genre: string;
  description: string;
  quality: string;
  url: string;
  artwork: string;
}

export const RADIO_STATIONS: readonly RadioStation[] = [
  {
    id: 'hitfm',
    name: 'Хіт FM',
    shortName: 'ХІТ',
    genre: 'Hits / Pop',
    description: 'Популярні українські та світові хіти',
    quality: 'HD',
    url: 'https://online.hitfm.ua/HitFM_HD',
    artwork: 'linear-gradient(145deg, #6d28d9 0%, #db2777 58%, #111827 100%)',
  },
  {
    id: 'kissfm',
    name: 'KISS FM',
    shortName: 'KISS',
    genre: 'Dance / Electronic',
    description: 'Електронна та танцювальна музика',
    quality: 'HD',
    url: 'https://online.kissfm.ua/KissFM_HD',
    artwork: 'linear-gradient(145deg, #ec4899 0%, #7c3aed 54%, #111827 100%)',
  },
  {
    id: 'radioroks',
    name: 'Radio ROKS',
    shortName: 'ROKS',
    genre: 'Rock',
    description: 'Класичний і сучасний рок',
    quality: 'HD',
    url: 'https://online.radioroks.ua/RadioROKS_HD',
    artwork: 'linear-gradient(145deg, #111827 0%, #7f1d1d 58%, #020617 100%)',
  },
  {
    id: 'relax',
    name: 'Radio Relax',
    shortName: 'RELAX',
    genre: 'Relax / Lounge',
    description: 'Спокійна музика та soft pop',
    quality: 'HD',
    url: 'https://online.radiorelax.ua/RadioRelax_HD',
    artwork: 'linear-gradient(145deg, #0f766e 0%, #155e75 56%, #0f172a 100%)',
  },
  {
    id: 'nrj',
    name: 'NRJ Ukraine',
    shortName: 'NRJ',
    genre: 'Hits / Dance',
    description: 'Сучасна поп- і танцювальна музика',
    quality: '320 kbps',
    url: 'https://cast.mediaonline.net.ua/nrj320',
    artwork: 'linear-gradient(145deg, #dc2626 0%, #991b1b 48%, #111827 100%)',
  },
  {
    id: 'radionv',
    name: 'Radio NV',
    shortName: 'NV',
    genre: 'News / Talk',
    description: 'Новини, аналітика та розмовні програми',
    quality: 'MP3',
    url: 'https://online-radio.nv.ua/radionv.mp3',
    artwork: 'linear-gradient(145deg, #dc2626 0%, #18181b 58%, #09090b 100%)',
  },
  {
    id: 'ur1',
    name: 'Українське Радіо',
    shortName: 'УР',
    genre: 'News / Public',
    description: 'Перший канал Суспільного Радіо',
    quality: 'MP3',
    url: 'https://radio.ukr.radio/ur1-mp3',
    artwork: 'linear-gradient(145deg, #1d4ed8 0%, #0f3f8f 55%, #facc15 140%)',
  },
  {
    id: 'promin',
    name: 'Радіо Промінь',
    shortName: 'ПРОМІНЬ',
    genre: 'Ukrainian / Pop',
    description: 'Українська музика та молодіжні програми',
    quality: 'MP3',
    url: 'https://radio.ukr.radio/ur2-mp3',
    artwork: 'linear-gradient(145deg, #7c3aed 0%, #4338ca 52%, #0f172a 100%)',
  },
  {
    id: 'jazz',
    name: 'Radio Jazz',
    shortName: 'JAZZ',
    genre: 'Jazz',
    description: 'Jazz, soul, funk та суміжні жанри',
    quality: 'HD',
    url: 'https://online.radiojazz.ua/RadioJazz_HD',
    artwork: 'linear-gradient(145deg, #b45309 0%, #78350f 50%, #111827 100%)',
  },
  {
    id: 'melodia',
    name: 'Мелодія FM',
    shortName: 'МЕЛОДІЯ',
    genre: 'Pop / Retro',
    description: 'Відомі хіти різних років',
    quality: 'HD',
    url: 'https://online.melodiafm.ua/MelodiaFM_HD',
    artwork: 'linear-gradient(145deg, #be185d 0%, #7e22ce 52%, #172554 100%)',
  },
];

function normalizeStreamUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

export function isSameRadioStream(left: string | null | undefined, right: string): boolean {
  return Boolean(left && normalizeStreamUrl(left) === normalizeStreamUrl(right));
}

export function findRadioStation(url: string | null | undefined): RadioStation | undefined {
  if (!url) return undefined;
  return RADIO_STATIONS.find((station) => isSameRadioStream(url, station.url));
}
