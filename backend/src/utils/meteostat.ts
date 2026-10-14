/**
 * Meteostat daily precipitation for a point, through its RapidAPI JSON API.
 * Meteostat interpolates the nearest stations (for Sokoto: 65010 Sokoto and
 * 61075 Birni N'Konni) and returns null for days not reported yet, which
 * typically lag about a week. The free plan allows 500 requests a month.
 */

const POINT_DAILY_URL = "https://meteostat.p.rapidapi.com/point/daily";

export interface MeteostatQuery {
  apiKey: string;
  latitude: number;
  longitude: number;
  /** First and last day, as YYYYMMDD. */
  start: string;
  end: string;
}

const isoDate = (day: string) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;

/** Daily rainfall in mm by YYYYMMDD; days without a reading yet are left out. */
export async function fetchMeteostatDaily(query: MeteostatQuery, fetchImpl: typeof fetch = fetch): Promise<Map<string, number>> {
  const url = new URL(POINT_DAILY_URL);
  url.search = new URLSearchParams({
    lat: String(query.latitude),
    lon: String(query.longitude),
    start: isoDate(query.start),
    end: isoDate(query.end),
  }).toString();
  const res = await fetchImpl(url, { headers: { "x-rapidapi-key": query.apiKey, "x-rapidapi-host": url.host } });
  if (!res.ok) throw new Error(`Meteostat answered ${res.status}`);
  const body = (await res.json()) as { data?: Array<{ date?: string; prcp?: number | null }> };
  if (!Array.isArray(body.data)) throw new Error("Meteostat response has no data series");
  const daily = new Map<string, number>();
  for (const { date, prcp } of body.data) {
    // Dates come as "2026-10-01 00:00:00".
    if (typeof date === "string" && typeof prcp === "number") daily.set(date.slice(0, 10).replaceAll("-", ""), prcp);
  }
  return daily;
}
