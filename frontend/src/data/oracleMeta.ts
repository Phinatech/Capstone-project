import type { SourceId } from '../types/insurance';

export interface OracleMeta {
  provider: string;
  product: string;
  resolution: string;
  cadence: string;
  method: string;
  endpoint: string;
  /** Modelled response time from the oracle relayer to the source API, seconds. */
  responseSec: number;
  /** Illustrative request success rate over the backtest window. */
  uptime: number;
  licence: string;
}

// Illustrative metadata for the prototype. Replace response time and uptime with measured Sepolia values.
export const oracleMeta: Record<SourceId, OracleMeta> = {
  chirps: {
    provider: 'Climate Hazards Center, UC Santa Barbara',
    product: 'CHIRPS v2.0 daily precipitation',
    resolution: '0.05° grid (≈5.5 km)',
    cadence: 'Daily · final release ≈3 weeks after month end',
    method: 'Infrared satellite estimates blended with station records',
    endpoint: 'data.chc.ucsb.edu/products/CHIRPS-2.0',
    responseSec: 1.8,
    uptime: 0.992,
    licence: 'Public domain'
  },
  nasa: {
    provider: 'NASA Langley Research Center',
    product: 'POWER Daily API · PRECTOTCORR',
    resolution: '0.5° × 0.625° grid (≈55 km)',
    cadence: 'Daily · near real time',
    method: 'MERRA-2 reanalysis, bias-corrected',
    endpoint: 'power.larc.nasa.gov/api/temporal/daily/point',
    responseSec: 1.2,
    uptime: 0.997,
    licence: 'Open, attribution requested'
  },
  meteostat: {
    provider: 'Meteostat',
    product: 'Point Daily API · prcp',
    resolution: 'Station point, interpolated to site',
    cadence: 'Daily',
    method: 'Ground station observations (Sokoto airport)',
    endpoint: 'meteostat.p.rapidapi.com/point/daily',
    responseSec: 0.9,
    uptime: 0.984,
    licence: 'CC BY-NC 4.0'
  }
};