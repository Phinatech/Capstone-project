export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentName = 'petrol' | 'indigo' | 'plum' | 'graphite';

export const accentOptions: {value: AccentName;swatch: string;}[] = [
{ value: 'petrol', swatch: '#0f5b6e' },
{ value: 'indigo', swatch: '#3e4bb5' },
{ value: 'plum', swatch: '#7a3b6e' },
{ value: 'graphite', swatch: '#2f3a4a' }];


export const accentNames: AccentName[] = ['petrol', 'indigo', 'plum', 'graphite'];

export const modeOptions: ThemeMode[] = ['light', 'dark', 'system'];