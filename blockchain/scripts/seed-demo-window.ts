/**
 * Adds a coverage window that spans the three periods already finalized on
 * Sepolia, so the whole buy -> settle -> payout path can be demonstrated now
 * instead of waiting for the 2027 windows to close.
 *
 * Why this is legitimate: addCoverageWindow only requires periods to be
 * strictly increasing and sales to close in the future. _issue only requires
 * the window to exist, sales to be open, and the pool to have capacity. The
 * contract places no restriction on the window's periods already having
 * finalized aggregates - which is exactly the state we are in:
 *
 *   2026092 -> 2452 (24.52 mm)
 *   2026093 -> 4266 (42.66 mm)
 *   2026101 -> 1117 (11.17 mm)
 *   -------------------------
 *   window total   7835 (78.35 mm)  -- a dry spell, so a payout is due
 *
 * This window is a demonstration vehicle. The production windows are the
 * 2027 ones, which settle against next season's readings.
 *
 * Usage:
 *   npx hardhat run scripts/seed-demo-window.ts --network sepolia
 */
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

const { ethers, networkName } = await network.create({ network: "sepolia" });
if (networkName !== "sepolia") {
  throw new Error(`seed-demo-window only targets the sepolia network (got "${networkName}")`);
}

const envPath = new URL("../../backend/.env", import.meta.url);
const envText = await readFile(envPath, "utf8");
const getEnv = (key: string): string => {
  const match = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
};

const INSURANCE_ADDRESS = getEnv("WEATHER_INDEX_INSURANCE_ADDRESS");
if (!INSURANCE_ADDRESS) throw new Error("Missing WEATHER_INDEX_INSURANCE_ADDRESS in backend/.env");

const [deployer] = await ethers.getSigners();
const insurance = await ethers.getContractAt("WeatherIndexInsurance", INSURANCE_ADDRESS);

// The three already-finalized periods, in strictly increasing order.
const PERIODS = [2026092, 2026093, 2026101];

// Rainfall already finalized on-chain, in mm * 100.
const FINALIZED: Record<number, number> = { 2026092: 2452, 2026093: 4266, 2026101: 1117 };
const windowRainfall = PERIODS.reduce((sum, p) => sum + (FINALIZED[p] ?? 0), 0);

// Keep sales open long enough to buy from the UI.
const salesCloseAt = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

console.log(`Adding demo window on ${deployer.address}`);
console.log(`  WeatherIndexInsurance: ${INSURANCE_ADDRESS}`);
console.log(`  periods: ${PERIODS.join(", ")}  (all finalized)`);
console.log(`  window rainfall so far: ${windowRainfall} = ${(windowRainfall / 100).toFixed(2)} mm`);
console.log(`  sales close: ${new Date(Number(salesCloseAt) * 1000).toISOString().slice(0, 10)}`);
console.log("");

// ---------- Check whether it already exists ----------
const nextId = await insurance.nextWindowId().catch(() => null);
if (nextId !== null) {
  for (let id = 0n; id < nextId; id++) {
    try {
      const w = await insurance.getCoverageWindow(id);
      const periods = (w[1] as bigint[]).map(Number);
      if (periods.length === PERIODS.length && periods.every((p, i) => p === PERIODS[i])) {
        console.log(`Demo window already exists as window #${id} - not adding another.`);
        await printBuyInstructions(insurance, id, windowRainfall);
        process.exit(0);
      }
    } catch {
      /* window may not exist; keep scanning */
    }
  }
}

// ---------- Add it ----------
try {
  const tx = await insurance.addCoverageWindow(PERIODS, salesCloseAt);
  const receipt = await tx.wait();
  const windowId = (await insurance.nextWindowId()) - 1n;
  console.log(`Added demo window #${windowId}  (tx ${receipt?.hash})`);
  console.log("");
  await printBuyInstructions(insurance, windowId, windowRainfall);
} catch (e: unknown) {
  const err = e as { reason?: string; message?: string };
  console.log(`Failed to add window: ${err.reason ?? err.message}`);
}

async function printBuyInstructions(
  contract: typeof insurance,
  windowId: bigint,
  rainfall: number,
): Promise<void> {
  const rateBps = await contract.premiumRateBps().catch(() => 1000n);
  const capacity = await contract.availableCapacity().catch(() => 0n);

  // A payout of 0.1 ETH needs a premium of 10% = 0.01 ETH.
  const payout = ethers.parseEther("0.1");
  const premium = (payout * rateBps) / 10_000n;

  console.log("Buy parameters for the UI (or buyPolicy call):");
  console.log(`  windowId            ${windowId}`);
  console.log(`  droughtThresholdMm  30000      // 300 mm; rainfall is only ${(rainfall / 100).toFixed(2)} mm`);
  console.log(`  payoutAmount        ${ethers.formatEther(payout)} ETH`);
  console.log(`  premium to send     ${ethers.formatEther(premium)} ETH  (${rateBps} bps)`);
  console.log(`  availableCapacity   ${ethers.formatEther(capacity)} ETH`);
  console.log("");
  console.log(`Because ${(rainfall / 100).toFixed(2)} mm < 300 mm, checkAndSettle will pay out.`);
}
