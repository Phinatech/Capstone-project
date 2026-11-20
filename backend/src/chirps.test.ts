import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { writeArrayBuffer } from "geotiff";
import { dailyUrls, eachDate, fetchChirpsDaily, pixelAt } from "./utils/chirps.js";

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

describe("dailyUrls", () => {
  it("points at the v3.0 final and preliminary rasters for the day", () => {
    assert.deepEqual(dailyUrls("https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily", "20261015"), {
      final: "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/final/sat/2026/chirps-v3.0.sat.2026.10.15.tif",
      prelim: "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/prelim/sat/2026/chirps-v3.0.prelim.2026.10.15.tif",
    });
  });

  it("tolerates a trailing slash on the base", () => {
    assert.equal(
      dailyUrls("https://example.test/daily/", "20260105").final,
      "https://example.test/daily/final/sat/2026/chirps-v3.0.sat.2026.01.05.tif",
    );
  });
});

describe("fetchChirpsDaily", () => {
  const BASE = "https://example.test/daily";
  const point = { baseUrl: BASE, latitude: 13.05, longitude: 5.23 };

  /** A 2x2 raster over 0..10°E, 10..20°N whose cell for Sokoto holds `mm` (the test writer stores whole numbers). */
  async function raster(mm: number): Promise<ArrayBuffer> {
    return writeArrayBuffer([0, 0, 0, mm], {
      height: 2,
      width: 2,
      ModelPixelScale: [5, 5, 0],
      ModelTiepoint: [0, 0, 0, 0, 20, 0],
      GeographicTypeGeoKey: 4326,
      GTModelTypeGeoKey: 2,
      GTRasterTypeGeoKey: 1,
    } as never);
  }

  /** A fetch that serves `files` by URL, answers 404 for anything else, and logs every request. */
  function fakeFetch(files: Record<string, ArrayBuffer>) {
    const requested: string[] = [];
    const impl = (async (url: string) => {
      requested.push(url);
      const body = files[url];
      return body ? new Response(body) : new Response(null, { status: 404 });
    }) as unknown as typeof fetch;
    return { impl, requested };
  }

  async function tempCache(contents?: object): Promise<string> {
    const path = join(await mkdtemp(join(tmpdir(), "chirps-")), "cache.json");
    if (contents) await writeFile(path, JSON.stringify(contents));
    return path;
  }

  it("reads the final file and does not ask for the preliminary one", async () => {
    const urls = dailyUrls(BASE, "20261015");
    const { impl, requested } = fakeFetch({ [urls.final]: await raster(6) });
    const daily = await fetchChirpsDaily(point, "20261015", "20261015", impl);
    assert.equal(daily.get("20261015"), 6);
    assert.deepEqual(requested, [urls.final]);
  });

  it("falls back to the preliminary file while the final one is not out", async () => {
    const urls = dailyUrls(BASE, "20261105");
    const { impl } = fakeFetch({ [urls.prelim]: await raster(2) });
    const daily = await fetchChirpsDaily(point, "20261105", "20261105", impl);
    assert.equal(daily.get("20261105"), 2);
  });

  it("keeps a cached preliminary value without downloading it again, but still checks for the final", async () => {
    const urls = dailyUrls(BASE, "20261105");
    const cachePath = await tempCache();
    await fetchChirpsDaily({ ...point, cachePath }, "20261105", "20261105", fakeFetch({ [urls.prelim]: await raster(2) }).impl);

    const second = fakeFetch({});
    const daily = await fetchChirpsDaily({ ...point, cachePath }, "20261105", "20261105", second.impl);
    assert.equal(daily.get("20261105"), 2);
    assert.deepEqual(second.requested, [urls.final]);

    const third = fakeFetch({ [urls.final]: await raster(3) });
    const upgraded = await fetchChirpsDaily({ ...point, cachePath }, "20261105", "20261105", third.impl);
    assert.equal(upgraded.get("20261105"), 3, "the final value replaces the preliminary one");
    const saved = JSON.parse(await readFile(cachePath, "utf8")) as Record<string, number>;
    assert.equal(saved["v3:20261105"], 3);
  });

  it("ignores v2.0 values an older cache file holds under bare dates", async () => {
    const cachePath = await tempCache({ "20261015": 99 });
    const daily = await fetchChirpsDaily({ ...point, cachePath }, "20261015", "20261015", fakeFetch({}).impl);
    assert.equal(daily.has("20261015"), false);
  });

  it("leaves out days that have neither file, so the dekad reads as incomplete", async () => {
    const urls = dailyUrls(BASE, "20261101");
    const { impl } = fakeFetch({ [urls.final]: await raster(1) });
    const daily = await fetchChirpsDaily(point, "20261101", "20261102", impl);
    assert.deepEqual([...daily.keys()], ["20261101"]);
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
