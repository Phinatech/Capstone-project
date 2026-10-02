/**
 * Deploys the contracts to a local Hardhat node and seeds them for
 * development, then writes the addresses into frontend/.env and backend/.env.
 *
 *   npm run chain        # terminal 1: local node on http://localhost:8545
 *   npm run seed:local   # terminal 2: this script
 *
 * Local only: the oracle accounts are Hardhat's well-known test accounts,
 * whose private keys are public. Restarting the node wipes the chain, so
 * rerun this script after every restart.
 */
import { readFile, writeFile } from "node:fs/promises";
import { network } from "hardhat";

const { ethers, networkName } = await network.create();
if (networkName !== "localhost") {
  throw new Error(`seed-local only targets the localhost network (got "${networkName}")`);
}

// Hardhat's default test mnemonic, used to hand the oracle keys to the relayer.
const TEST_MNEMONIC = "test test test test test test test test test test test junk";

// Base weights from the admin Oracles page (frontend/src/utils/oracle.ts on
// the illustrative 2023 data). Replace with the rain-gauge backtest results.
const ORACLES = [
  { label: "CHIRPS", accountIndex: 2, weight: 421 },
  { label: "NASA_POWER", accountIndex: 3, weight: 268 },
  { label: "Meteostat", accountIndex: 4, weight: 311 },
];

// Same windows as frontend/src/data/policies.ts: dekad indices from 0 = 1-10 June.
const WINDOWS = [
  { id: "jun", label: "June establishment", start: 0, end: 2 },
  { id: "jul", label: "July critical growth", start: 3, end: 5 },
  { id: "junjul", label: "June - July", start: 0, end: 5 },
  { id: "julaug", label: "July - August", start: 3, end: 8 },
  { id: "augsep", label: "August - September", start: 6, end: 11 },
];

const POOL_FUNDING = ethers.parseEther("10");

// Period mapping is shared with the backend relayer via @weather/backend/utils/period.
// Re-exported here for convenience; the canonical implementation lives there.
import { dekadIndexToPeriodId, dekadIndexToStart } from "../../backend/src/utils/period.js";

const periodId = dekadIndexToPeriodId;
const dekadStart = dekadIndexToStart;

async function upsertEnv(file: URL, example: URL, values: Record<string, string>) {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    text = await readFile(example, "utf8");
  }
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
  }
  await writeFile(file, text);
}

const signers = await ethers.getSigners();
const [deployer] = signers;

// ---------- Deploy ----------
const aggregator = await ethers.deployContract("OracleAggregator");
const insurance = await ethers.deployContract("WeatherIndexInsurance", [await aggregator.getAddress()]);
const aggregatorAddress = await aggregator.getAddress();
const insuranceAddress = await insurance.getAddress();

// ---------- Oracles ----------
const oracleKeys: string[] = [];
for (const o of ORACLES) {
  const wallet = ethers.HDNodeWallet.fromPhrase(TEST_MNEMONIC, undefined, `m/44'/60'/0'/0/${o.accountIndex}`);
  if (wallet.address !== signers[o.accountIndex].address) {
    throw new Error(`Account #${o.accountIndex} doesn't match the default test mnemonic`);
  }
  await (await aggregator.registerOracle(wallet.address, o.label, o.weight)).wait();
  oracleKeys.push(`${o.label}:${wallet.privateKey}`);
}

// ---------- Pool ----------
await (await insurance.fundPool({ value: POOL_FUNDING })).wait();

// ---------- Coverage windows for the next season still on sale ----------
const now = Number((await ethers.provider.getBlock("latest"))!.timestamp);
let season = new Date(now * 1000).getUTCFullYear();
if (dekadStart(season, 0) <= now) season += 1;

const windowRows: string[] = [];
for (const w of WINDOWS) {
  const periods: number[] = [];
  for (let i = w.start; i <= w.end; i++) periods.push(periodId(season, i));
  const salesCloseAt = dekadStart(season, w.start);
  await (await insurance.addCoverageWindow(periods, salesCloseAt)).wait();
  windowRows.push(
    `  #${windowRows.length} ${w.label.padEnd(22)} ${periods[0]}-${periods.at(-1)}  sales close ${new Date(salesCloseAt * 1000).toISOString().slice(0, 10)}`,
  );
}

// ---------- .env files ----------
const root = new URL("../../", import.meta.url);
const rpcUrl = "http://localhost:8545";
await upsertEnv(new URL("frontend/.env", root), new URL("frontend/.env.example", root), {
  VITE_RPC_URL: rpcUrl,
  VITE_ORACLE_AGGREGATOR_ADDRESS: aggregatorAddress,
  VITE_WEATHER_INDEX_INSURANCE_ADDRESS: insuranceAddress,
});
await upsertEnv(new URL("backend/.env", root), new URL("backend/.env.example", root), {
  RPC_URL: rpcUrl,
  ORACLE_AGGREGATOR_ADDRESS: aggregatorAddress,
  WEATHER_INDEX_INSURANCE_ADDRESS: insuranceAddress,
  ORACLE_SOURCES: oracleKeys.join(","),
});

console.log(`Deployed by ${deployer.address}
  OracleAggregator       ${aggregatorAddress}
  WeatherIndexInsurance  ${insuranceAddress}

Oracles: ${ORACLES.map((o) => `${o.label} (account #${o.accountIndex}, weight ${o.weight})`).join(", ")}
Pool funded with ${ethers.formatEther(POOL_FUNDING)} ETH

Coverage windows, ${season} season:
${windowRows.join("\n")}

Wrote frontend/.env and backend/.env.`);
