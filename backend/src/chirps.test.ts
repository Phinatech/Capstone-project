import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dailyUrl, eachDate, pixelAt } from "./utils/chirps.js";

// The real geometry of CHIRPS 2.0 p05, as read from a downloaded raster.
const BBOX: [number, number, number, number] = [
  -180,
  -50.00000149011612,
  180.00000536441803,
  50,
];
const WIDTH = 7200;
const HEIGHT = 2000;

describe("eachDate", () => {
  it("lists every day of the range, including both ends", () => {
    assert.deepEqual(eachDate("20260908", "20260910"), ["20260908", "20260909", "20260910"]);
    assert.deepEqual(eachDate("20260101", "20260101"), ["20260101"]);
  });

  it("crosses a month and a year boundary", () => {
    assert.deepEqual(eachDate("20260130", "20260202"), [
      "20260130",
      "20260131",
      "20260201",
      "20260202",
    ]);
    assert.deepEqual(eachDate("20261230", "20270102"), [
      "20261230",
      "20261231",
      "20270101",
      "20270102",
    ]);
  });

  it("knows February has 28 days in a common year", () => {
    assert.deepEqual(eachDate("20260226", "20260301"), [
      "20260226",
      "20260227",
      "20260228",
      "20260301",
    ]);
    assert.deepEqual(eachDate("20280227", "20280301"), [
      "20280227",
      "20280228",
      "20280229",
      "20280301",
    ]);
  });
});

describe("dailyUrl", () => {
  it("points at the year folder and the dated raster", () => {
    assert.equal(
      dailyUrl("https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05", "20260915"),
      "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05/2026/chirps-v2.0.2026.09.15.tif.gz",
    );
  });

  it("tolerates a trailing slash on the base", () => {
    assert.equal(
      dailyUrl("https://example.test/p05/", "20260105"),
      "https://example.test/p05/2026/chirps-v2.0.2026.01.05.tif.gz",
    );
  });
});

describe("pixelAt", () => {
  it("resolves Sokoto to the cell a download confirms (col 3704, row 738)", () => {
    assert.deepEqual(pixelAt(BBOX, WIDTH, HEIGHT, 13.05, 5.23), { row: 738, col: 3704 });
  });

  it("walks one cell north for a half-degree of latitude", () => {
    assert.deepEqual(pixelAt(BBOX, WIDTH, HEIGHT, 13.3, 5.23), { row: 733, col: 3704 });
  });

  it("reports a point outside the grid rather than wrapping around", () => {
    const { row, col } = pixelAt(BBOX, WIDTH, HEIGHT, 80, 5.23);
    assert.ok(row < 0 || row >= HEIGHT);
    assert.equal(col, 3704);
  });
});
