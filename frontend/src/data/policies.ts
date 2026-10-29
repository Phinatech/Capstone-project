import type { CoverageWindow } from '../types/insurance';

/** Product configuration: where cover is sold and on what terms. */
export const lgas = ['Wamakko', 'Kware', 'Bodinga', 'Tambuwal', 'Gwadabawa', 'Illela', 'Goronyo', 'Rabah'];

export const crops = ['Millet', 'Sorghum'];

export const payoutOptionsEth = [0.01, 0.02, 0.05];

export const premiumRate = 0.1;

export const coverageWindows: CoverageWindow[] = [
{ id: 'jun', label: 'June establishment', start: 0, end: 2 },
{ id: 'jul', label: 'July critical growth', start: 3, end: 5 },
{ id: 'junjul', label: 'June – July', start: 0, end: 5 },
{ id: 'julaug', label: 'July – August', start: 3, end: 8 },
{ id: 'augsep', label: 'August – September', start: 6, end: 11 }];
