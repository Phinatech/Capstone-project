import type { DekadRainfall, OracleSource } from '../types/insurance';

export const oracleSources: OracleSource[] = [
{ id: 'chirps', name: 'CHIRPS', kind: 'Satellite + station blend', color: 'var(--src-chirps)' },
{ id: 'nasa', name: 'NASA POWER', kind: 'Reanalysis grid', color: 'var(--src-nasa)' },
{ id: 'meteostat', name: 'Meteostat', kind: 'Station interpolation', color: 'var(--src-meteostat)' }];


// Dekadal (10-day) rainfall totals in mm, Sokoto State, June–October 2023.
// Illustrative prototype values; replace with pulled CHIRPS / NASA POWER / Meteostat exports.
// "reference" is the gauge record used only to validate payout decisions in the backtest.
export const dekadalRainfall: DekadRainfall[] = [
{ label: 'Jun D1', reference: 8, chirps: 10, nasa: 11, meteostat: 7 },
{ label: 'Jun D2', reference: 22, chirps: 24, nasa: 26, meteostat: 21 },
{ label: 'Jun D3', reference: 31, chirps: 29, nasa: 34, meteostat: 33 },
{ label: 'Jul D1', reference: 28, chirps: 30, nasa: 32, meteostat: 27 },
{ label: 'Jul D2', reference: 19, chirps: 20, nasa: 23, meteostat: 18 },
{ label: 'Jul D3', reference: 34, chirps: 35, nasa: 38, meteostat: 32 },
{ label: 'Aug D1', reference: 62, chirps: 60, nasa: 68, meteostat: 63 },
{ label: 'Aug D2', reference: 71, chirps: 68, nasa: 77, meteostat: 70 },
{ label: 'Aug D3', reference: 58, chirps: 61, nasa: 64, meteostat: 56 },
{ label: 'Sep D1', reference: 44, chirps: 42, nasa: 48, meteostat: 45 },
{ label: 'Sep D2', reference: 30, chirps: 32, nasa: 34, meteostat: 29 },
{ label: 'Sep D3', reference: 18, chirps: 16, nasa: 21, meteostat: 17 },
{ label: 'Oct D1', reference: 9, chirps: 11, nasa: 12, meteostat: 8 },
{ label: 'Oct D2', reference: 2, chirps: 3, nasa: 4, meteostat: 2 },
{ label: 'Oct D3', reference: 0, chirps: 0, nasa: 1, meteostat: 0 }];