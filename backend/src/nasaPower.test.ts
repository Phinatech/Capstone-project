import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dekadTotal } from "./utils/feeds.js";
import { fetchNasaPowerDaily } from "./utils/nasaPower.js";
import { dekadDays } from "./utils/period.js";

/** A NASA POWER daily response for 1-10 October with `overrides` applied. */
function octoberDekad(overrides: Record<string, number> = {}): Record<string, number> {
  const daily: Record<string, number> = {};
  for (const day of dekadDays(2026101)) daily[day] = 1.5;
  return { ...daily, ...overrides };
}

function respondWith(daily: Record<string, number>, seen?: { url?: string }): typeof fetch {
  return (async (url: string | URL | Request) => {
    if (seen) seen.url = String(url);
    return new Response(JSON.stringify({ properties: { parameter: { PRECTOTCORR: daily } } }));
  }) as typeof fetch;
}

const query = { apiUrl: "https://power.example/api", latitude: 13.05, longitude: 5.23, start: "20261001", end: "20261010" };

describe("NASA POWER feed", () => {
  it("asks for corrected daily precipitation at the insured location", async () => {
    const seen: { url?: string } = {};
    await fetchNasaPowerDaily(query, respondWith(octoberDekad(), seen));
    const params = new URL(seen.url!).searchParams;
    assert.equal(params.get("parameters"), "PRECTOTCORR");
    assert.equal(params.get("latitude"), "13.05");
    assert.equal(params.get("longitude"), "5.23");
    assert.equal(params.get("start"), "20261001");
    assert.equal(params.get("end"), "20261010");
  });

  it("totals a complete dekad in mm", async () => {
    const daily = await fetchNasaPowerDaily(query, respondWith(octoberDekad({ "20261004": 12.25 })));
    assert.equal(dekadTotal(daily, 2026101), 9 * 1.5 + 12.25);
  });

  it("waits while a day is still the fill value", async () => {
    const daily = await fetchNasaPowerDaily(query, respondWith(octoberDekad({ "20261010": -999 })));
    assert.equal(dekadTotal(daily, 2026101), null);
  });

  it("waits while a day is missing from the response", async () => {
    const { ["20261007"]: _, ...withoutDay } = octoberDekad();
    const daily = await fetchNasaPowerDaily(query, respondWith(withoutDay));
    assert.equal(dekadTotal(daily, 2026101), null);
  });

  it("treats an error response as a failed fetch, not as no rain", async () => {
    const failing = (async () => new Response("busy", { status: 503 })) as typeof fetch;
    await assert.rejects(fetchNasaPowerDaily(query, failing), /503/);
  });
});
