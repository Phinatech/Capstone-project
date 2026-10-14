import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completedPeriods, dekadDays, parsePeriodId, previousPeriod } from "./utils/period.js";

describe("dekad periods", () => {
  it("splits a period id into year, month and dekad", () => {
    assert.deepEqual(parsePeriodId(2026101), { year: 2026, month: 10, dekad: 1 });
    assert.deepEqual(parsePeriodId(2027123), { year: 2027, month: 12, dekad: 3 });
  });

  it("steps back across month and year boundaries", () => {
    assert.equal(previousPeriod(2026103), 2026102);
    assert.equal(previousPeriod(2026101), 2026093);
    assert.equal(previousPeriod(2027011), 2026123);
  });

  it("lists only dekads that have ended, oldest first", () => {
    // 14 Oct is inside the 11-20 Oct dekad, so 1-10 Oct is the newest finished one.
    assert.deepEqual(completedPeriods(new Date("2026-10-14T12:00:00Z"), 3), [2026092, 2026093, 2026101]);
    assert.deepEqual(completedPeriods(new Date("2027-01-05T00:00:00Z"), 2), [2026122, 2026123]);
  });

  it("covers every day of a dekad, including short and long months", () => {
    assert.deepEqual(dekadDays(2026101), ["20261001", "20261002", "20261003", "20261004", "20261005",
      "20261006", "20261007", "20261008", "20261009", "20261010"]);
    assert.equal(dekadDays(2026102)[0], "20261011");
    assert.equal(dekadDays(2026103).length, 11); // 21-31 October
    assert.equal(dekadDays(2027023).length, 8); // 21-28 February 2027
    assert.equal(dekadDays(2028023).at(-1), "20280229"); // leap year
  });
});
