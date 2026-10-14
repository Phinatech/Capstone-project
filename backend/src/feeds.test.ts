import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dailyFeed } from "./utils/feeds.js";
import { dekadDays } from "./utils/period.js";

/** Daily rainfall of 2 mm on every day of `periods`, minus `missing` days. */
function rain(periods: number[], missing: string[] = []): Map<string, number> {
  const days = periods.flatMap(dekadDays).filter((day) => !missing.includes(day));
  return new Map(days.map((day) => [day, 2]));
}

/** A daily fetch that serves `rain(...)` and records each requested range. */
function api(missing: string[] = []) {
  const asked: string[] = [];
  const fetchDaily = async (start: string, end: string) => {
    asked.push(`${start}-${end}`);
    return rain([2026092, 2026093, 2026101, 2026102], missing);
  };
  return { fetchDaily, asked };
}

describe("dailyFeed", () => {
  it("totals only dekads with data for every day", async () => {
    const { fetchDaily } = api(["20261008"]);
    const totals = await dailyFeed(fetchDaily)([2026093, 2026101]);
    assert.deepEqual([...totals], [[2026093, 20]]); // 21-30 Sep: 10 days x 2 mm
  });

  it("re-asks for the same days only after the interval", async () => {
    let clock = 0;
    const { fetchDaily, asked } = api();
    const feed = dailyFeed(fetchDaily, 6 * 3_600_000, () => clock);
    await feed([2026092, 2026093]);
    clock += 3_600_000;
    await feed([2026092, 2026093]);
    await feed([2026093]); // a reported dekad dropped out: still covered by the cached days
    assert.equal(asked.length, 1);
    clock += 6 * 3_600_000;
    await feed([2026093]);
    assert.equal(asked.length, 2);
  });

  it("asks right away when a newly finished dekad is due", async () => {
    let clock = 0;
    const { fetchDaily, asked } = api();
    const feed = dailyFeed(fetchDaily, 6 * 3_600_000, () => clock);
    await feed([2026092, 2026093]);
    clock += 60_000;
    await feed([2026093, 2026101]);
    assert.deepEqual(asked, ["20260911-20260930", "20260921-20261010"]);
  });
});
