/**
 * NASA POWER daily precipitation (PRECTOTCORR, mm/day) for a point. The API
 * is free and keyless; recent days lag about three days behind and come back
 * as the fill value until their data is in.
 */

const FILL_VALUE = -999;

export interface NasaPowerQuery {
  apiUrl: string;
  latitude: number;
  longitude: number;
  /** First and last day, as YYYYMMDD. */
  start: string;
  end: string;
}

/** Daily rainfall in mm by YYYYMMDD; days without data yet are left out. */
export async function fetchNasaPowerDaily(query: NasaPowerQuery, fetchImpl: typeof fetch = fetch): Promise<Map<string, number>> {
  const url = new URL(query.apiUrl);
  url.search = new URLSearchParams({
    parameters: "PRECTOTCORR",
    community: "AG",
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    start: query.start,
    end: query.end,
    format: "JSON",
  }).toString();
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`NASA POWER answered ${res.status}`);
  const body = (await res.json()) as { properties?: { parameter?: { PRECTOTCORR?: Record<string, number> } } };
  const daily = body.properties?.parameter?.PRECTOTCORR;
  if (!daily) throw new Error("NASA POWER response has no PRECTOTCORR series");
  return new Map(Object.entries(daily).filter(([, mm]) => mm !== FILL_VALUE));
}
