import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeFx } from "./utils/fx.js";
import { config } from "./config.js";

const live = { ethUsdSource: "live" as const, usdNgnSource: "live" as const };

describe("naira exchange rates", () => {
  it("combines the two legs into a naira-per-ETH quote", () => {
    const rate = composeFx(2000, 1500, live);
    assert.equal(rate.ethUsd, 2000);
    assert.equal(rate.usdNgn, 1500);
    assert.equal(rate.ethNgn, 3_000_000);
    assert.equal(rate.ethUsdSource, "live");
    assert.equal(rate.usdNgnSource, "live");
  });

  it("falls back when a provider returns an implausible value", () => {
    // A malformed body, a null, or a rate outside the sanity bounds should
    // never reach an agent's quote.
    for (const bad of [null, undefined, 0, -5, "abc", NaN, 1e9]) {
      const rate = composeFx(bad, 1500, live);
      assert.equal(rate.ethUsd, config.fxEthUsdFallback, String(bad));
      assert.equal(rate.ethUsdSource, "fallback", String(bad));
      assert.equal(rate.usdNgnSource, "live", String(bad));
      assert.ok(rate.ethNgn > 0);
    }
  });

  it("falls back on the naira leg too, and flags only that leg", () => {
    for (const bad of [null, 0, -1, "NGN", 250_000]) {
      const rate = composeFx(2400, bad, live);
      assert.equal(rate.usdNgn, config.fxUsdNgnFallback, String(bad));
      assert.equal(rate.usdNgnSource, "fallback", String(bad));
      assert.equal(rate.ethUsdSource, "live", String(bad));
      assert.equal(rate.ethNgn, rate.ethUsd * rate.usdNgn);
    }
  });

  it("keeps a naira quote available even when both providers are down", () => {
    const rate = composeFx(undefined, undefined, live);
    assert.equal(rate.ethUsdSource, "fallback");
    assert.equal(rate.usdNgnSource, "fallback");
    assert.equal(rate.ethNgn, config.fxEthUsdFallback * config.fxUsdNgnFallback);
    assert.ok(Number.isFinite(rate.ethNgn) && rate.ethNgn > 0);
  });

  it("stamps the quote so the UI can show its age", () => {
    const now = new Date().toISOString();
    assert.equal(composeFx(2000, 1500, { ...live, quotedAt: now }).quotedAt, now);
    assert.ok(!Number.isNaN(Date.parse(composeFx(2000, 1500, live).quotedAt)));
  });
});
