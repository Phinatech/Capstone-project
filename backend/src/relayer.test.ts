import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentPeriod } from "./relayer.js";

const at = (iso: string) => currentPeriod(new Date(`${iso}T12:00:00Z`));

describe("currentPeriod", () => {
  it("encodes year, month and dekad as YYYYMMD", () => {
    assert.equal(at("2026-06-05"), 2026061);
    assert.equal(at("2026-11-15"), 2026112);
    assert.equal(at("2026-12-25"), 2026123);
  });

  it("splits dekads on days 1-10, 11-20 and 21 to month end", () => {
    assert.equal(at("2026-06-01"), 2026061);
    assert.equal(at("2026-06-10"), 2026061);
    assert.equal(at("2026-06-11"), 2026062);
    assert.equal(at("2026-06-20"), 2026062);
    assert.equal(at("2026-06-21"), 2026063);
    assert.equal(at("2026-06-30"), 2026063);
    assert.equal(at("2026-07-31"), 2026073);
    assert.equal(at("2028-02-29"), 2028023);
  });

  it("gives late-year periods ids that don't collide with the next year", () => {
    // The old encoding mapped 5 Nov 2026 and 5 Jan 2027 to the same id.
    assert.notEqual(at("2026-11-05"), at("2027-01-05"));
    assert.ok(at("2026-12-25") < at("2027-01-05"));
  });

  it("gives every dekad of a year a distinct, increasing id", () => {
    const ids: number[] = [];
    for (let d = new Date("2026-01-01T12:00:00Z"); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
      const id = currentPeriod(d);
      if (ids.at(-1) !== id) ids.push(id);
    }
    assert.equal(ids.length, 36);
    assert.deepEqual([...ids].sort((a, b) => a - b), ids);
  });

  it("uses UTC, not local time", () => {
    // 23:30 on 10 June in UTC-1 is already 11 June in UTC.
    assert.equal(currentPeriod(new Date("2026-06-10T23:30:00-01:00")), 2026062);
  });
});
