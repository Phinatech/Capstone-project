import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchMeteostatDaily } from "./utils/meteostat.js";

const query = { apiKey: "test-key", latitude: 13.05, longitude: 5.23, start: "20261001", end: "20261010" };

function respondWith(body: unknown, status = 200, seen?: { url?: string; headers?: Headers }): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (seen) {
      seen.url = String(url);
      seen.headers = new Headers(init?.headers);
    }
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe("Meteostat feed", () => {
  it("asks for the point's daily data with the RapidAPI key", async () => {
    const seen: { url?: string; headers?: Headers } = {};
    await fetchMeteostatDaily(query, respondWith({ data: [] }, 200, seen));
    const url = new URL(seen.url!);
    assert.equal(url.pathname, "/point/daily");
    assert.equal(url.searchParams.get("lat"), "13.05");
    assert.equal(url.searchParams.get("lon"), "5.23");
    assert.equal(url.searchParams.get("start"), "2026-10-01");
    assert.equal(url.searchParams.get("end"), "2026-10-10");
    assert.equal(seen.headers!.get("x-rapidapi-key"), "test-key");
    assert.equal(seen.headers!.get("x-rapidapi-host"), "meteostat.p.rapidapi.com");
  });

  it("reads Meteostat's dates and leaves out days without a reading", async () => {
    const daily = await fetchMeteostatDaily(
      query,
      respondWith({
        data: [
          { date: "2026-10-01 00:00:00", prcp: 7 },
          { date: "2026-10-02 00:00:00", prcp: 0 },
          { date: "2026-10-08 00:00:00", prcp: null },
        ],
      })
    );
    assert.deepEqual([...daily], [["20261001", 7], ["20261002", 0]]);
  });

  it("treats an error response as a failed fetch, not as no rain", async () => {
    await assert.rejects(fetchMeteostatDaily(query, respondWith({ message: "quota" }, 429)), /429/);
  });
});
