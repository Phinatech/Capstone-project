/**
 * Seeds a fresh Sepolia deployment with oracles, pool funding and coverage
 * windows. Readings come from the backend relayer, never from this script: a
 * made-up reading would finalize into real policies' windows.
 * To switch an existing deployment to new oracle keys, use go-live.ts.
 *
 * Prerequisites:
 *   - Contracts deployed to Sepolia (via Ignition)
 *   - SEPOLIA_PRIVATE_KEY and SEPOLIA_RPC_URL in Hardhat keystore
 *   - backend/.env has the contract addresses
 *
 * Usage:
 *   npx hardhat run scripts/seed-sepolia.ts --network sepolia
 */
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

const { ethers, networkName } = await network.create({ network: "sepolia" });
if (networkName !== "sepolia") {
  throw new Error(`seed-sepolia only targets the sepolia network (got "${networkName}")`);
}

// Read contract addresses from backend/.env
const envPath = new URL("../../backend/.env", import.meta.url);
const envText = await readFile(envPath, "utf8");
const getEnv = (key: string): string => {
  const match = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
};

const AGGREGATOR_ADDRESS = getEnv("ORACLE_AGGREGATOR_ADDRESS");
const INSURANCE_ADDRESS = getEnv("WEATHER_INDEX_INSURANCE_ADDRESS");
const ORACLE_SOURCES = getEnv("ORACLE_SOURCES");

if (!AGGREGATOR_ADDRESS || !INSURANCE_ADDRESS) {
  throw new Error("Missing contract addresses in backend/.env");
}

// Get the deployer signer from Hardhat (uses the keystore)
const [deployer] = await ethers.getSigners();

// Parse oracle private keys from ORACLE_SOURCES
const oracleWallets = ORACLE_SOURCES.split(",").map((entry) => {
  const [label, privateKey] = entry.split(":").map((s) => s.trim());
  return { label, wallet: new ethers.Wallet(privateKey, ethers.provider) };
});

// Oracle configuration
const ORACLES = [
  { label: "CHIRPS", weight: 421 },
  { label: "NASA_POWER", weight: 268 },
  { label: "Meteostat", weight: 311 },
];

const WINDOWS = [
  { id: "jun", label: "June establishment", start: 0, end: 2 },
  { id: "jul", label: "July critical growth", start: 3, end: 5 },
  { id: "junjul", label: "June - July", start: 0, end: 5 },
  { id: "julaug", label: "July - August", start: 3, end: 8 },
  { id: "augsep", label: "August - September", start: 6, end: 11 },
];

const POOL_FUNDING = ethers.parseEther("0.5");
const ORACLE_GAS_FUNDING = ethers.parseEther("0.01");

function periodId(year: number, index: number): number {
  const month = 6 + Math.floor(index / 3);
  const dekad = (index % 3) + 1;
  return year * 1000 + month * 10 + dekad;
}

function dekadStart(year: number, index: number): number {
  const month = 6 + Math.floor(index / 3);
  const day = [1, 11, 21][index % 3];
  return Date.UTC(year, month - 1, day) / 1000;
}

console.log(`Seeding Sepolia deployment from ${deployer.address}`);
console.log(`  OracleAggregator: ${AGGREGATOR_ADDRESS}`);
console.log(`  WeatherIndexInsurance: ${INSURANCE_ADDRESS}`);

// ---------- Register Oracles ----------
const aggregator = await ethers.getContractAt("OracleAggregator", AGGREGATOR_ADDRESS);
for (let i = 0; i < ORACLES.length; i++) {
  const o = ORACLES[i];
  const oracleAddr = oracleWallets[i].wallet.address;
  try {
    const tx = await aggregator.registerOracle(oracleAddr, o.label, o.weight);
    await tx.wait();
    console.log(`  Registered oracle: ${o.label} (${oracleAddr.slice(0, 10)}..., weight ${o.weight})`);
  } catch (e: unknown) {
    const err = e as { reason?: string; message?: string };
    if (err.reason?.includes("already registered") || err.message?.includes("already registered")) {
      console.log(`  Oracle ${o.label} already registered, skipping`);
    } else {
      console.log(`  Failed to register ${o.label}: ${err.reason ?? err.message}`);
    }
  }
}

// ---------- Fund Pool ----------
const insurance = await ethers.getContractAt("WeatherIndexInsurance", INSURANCE_ADDRESS);
const currentPool = await ethers.provider.getBalance(INSURANCE_ADDRESS);
if (currentPool < ethers.parseEther("0.1")) {
  try {
    const tx = await insurance.fundPool({ value: POOL_FUNDING });
    await tx.wait();
    console.log(`  Funded pool with ${ethers.formatEther(POOL_FUNDING)} ETH`);
  } catch (e: unknown) {
    const err = e as { reason?: string; message?: string };
    console.log(`  Pool funding failed: ${err.reason ?? err.message}`);
  }
} else {
  console.log(`  Pool already funded (${ethers.formatEther(currentPool)} ETH), skipping`);
}

// ---------- Add Coverage Windows ----------
const now = Math.floor(Date.now() / 1000);
let season = new Date().getUTCFullYear();
if (dekadStart(season, 0) <= now) season += 1;

// The frontend maps window ids 0-4 to WINDOWS, so add them only once.
const existingWindows = await insurance.nextWindowId();
if (existingWindows > 0n) {
  console.log(`  Contract already has ${existingWindows} coverage windows, skipping`);
} else {
  for (const w of WINDOWS) {
    const periods: number[] = [];
    for (let i = w.start; i <= w.end; i++) periods.push(periodId(season, i));
    const salesCloseAt = dekadStart(season, w.start);
    try {
      const tx = await insurance.addCoverageWindow(periods, salesCloseAt);
      await tx.wait();
      console.log(`  Added window: ${w.label} (${periods[0]}-${periods.at(-1)})`);
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      console.log(`  Failed to add window ${w.label}: ${err.reason ?? err.message}`);
    }
  }
}

// ---------- Fund Oracle Wallets with Gas ----------
for (const { label, wallet } of oracleWallets) {
  const balance = await ethers.provider.getBalance(wallet.address);
  if (balance < ethers.parseEther("0.005")) {
    try {
      const tx = await deployer.sendTransaction({ to: wallet.address, value: ORACLE_GAS_FUNDING });
      await tx.wait();
      console.log(`  Funded ${label} oracle with ${ethers.formatEther(ORACLE_GAS_FUNDING)} ETH for gas`);
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      console.log(`  Failed to fund ${label} oracle: ${err.reason ?? err.message}`);
    }
  } else {
    console.log(`  ${label} oracle already funded, skipping`);
  }
}

console.log("\nSepolia seeding complete! Start the backend with RELAYER_ENABLED=true to report readings.");
console.log("Test the API: curl http://localhost:3001/api/policies");
