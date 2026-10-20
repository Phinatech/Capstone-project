/**
 * Rotates the Sepolia oracle keys after the original three were compromised.
 *
 * Background: the original oracle addresses were derived from the public
 * Hardhat/Foundry test mnemonic, so their private keys are published in
 * countless repos. Anyone could sign an EIP-7702 authorization and attach
 * draining code to them, which is exactly what happened on Sepolia. Those
 * addresses now reject inbound transfers (funding attempts revert) and would
 * execute attacker code instead of ours when signing.
 *
 * This script uses the contract's designed response to a leaked key
 * (audit finding L-5): deactivateOracle keeps the source's label and last
 * weight as history, and simply leaves it out of periods that haven't
 * started yet. The replacement addresses are then registered fresh.
 *
 * Prerequisites:
 *   - The new oracle private keys are in backend/.env under ORACLE_SOURCES
 *   - The new oracle wallets hold a little Sepolia ETH for gas
 *
 * Usage:
 *   npx hardhat run scripts/rotate-oracles.ts --network sepolia
 */
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

const { ethers, networkName } = await network.create({ network: "sepolia" });
if (networkName !== "sepolia") {
  throw new Error(`rotate-oracles only targets the sepolia network (got "${networkName}")`);
}

// Read contract addresses and the new oracle keys from backend/.env
const envPath = new URL("../../backend/.env", import.meta.url);
const envText = await readFile(envPath, "utf8");
const getEnv = (key: string): string => {
  const match = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
};

const AGGREGATOR_ADDRESS = getEnv("ORACLE_AGGREGATOR_ADDRESS");
const ORACLE_SOURCES = getEnv("ORACLE_SOURCES");

if (!AGGREGATOR_ADDRESS) {
  throw new Error("Missing ORACLE_AGGREGATOR_ADDRESS in backend/.env");
}
if (!ORACLE_SOURCES || ORACLE_SOURCES.includes("<")) {
  throw new Error("ORACLE_SOURCES in backend/.env still has placeholders — fill in the real keys first");
}

const [deployer] = await ethers.getSigners();
const aggregator = await ethers.getContractAt("OracleAggregator", AGGREGATOR_ADDRESS);

// Set C: the original addresses, derived from the public Hardhat/Foundry test
// mnemonic. Their keys are published everywhere, so they carried EIP-7702
// delegation code and rejected every inbound funding attempt.
const COMPROMISED = [
  { label: "CHIRPS", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
  { label: "NASA_POWER", address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
  { label: "Meteostat", address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" },
];

// Set A: an earlier working set that produced the finalized periods
// 2026092 / 2026093 / 2026101. It is clean, but its keys are no longer in
// backend/.env, so the relayer can't sign for it. Leaving it active would
// duplicate every label and double-count a single source in aggregation.
// Its finalized aggregates are stored on-chain and survive deactivation.
const DUPLICATE = [
  { label: "CHIRPS", address: "0x492c291f1a1a13e1532594113f4bb2f53894db37" },
  { label: "NASA_POWER", address: "0x9fdf51383c398ce596e622a4f8c0ccd9f046076b" },
  { label: "Meteostat", address: "0x9142ad3cb99838b25920e02530638cffa39a0a1f" },
];

// Weights matching the original registration, so the aggregate stays comparable.
const WEIGHTS: Record<string, bigint> = {
  CHIRPS: 421n,
  NASA_POWER: 268n,
  Meteostat: 311n,
};

// Parse and sanity-check the new keys, so a pasted address fails with a
// readable message instead of a bare ethers INVALID_ARGUMENT.
const newWallets = ORACLE_SOURCES.split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0)
  .map((entry) => {
    const [label, privateKey] = entry.split(":").map((s) => s.trim());
    const hex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error(`ORACLE_SOURCES: ${label} key is not hexadecimal`);
    }
    if (hex.length === 40) {
      throw new Error(
        `ORACLE_SOURCES: ${label} looks like a wallet ADDRESS (40 hex chars). ` +
          `A private key is 64 hex chars. In MetaMask: account menu -> Account details -> Show private key.`,
      );
    }
    if (hex.length !== 64) {
      throw new Error(
        `ORACLE_SOURCES: ${label} key is ${hex.length} hex chars, expected 64. Check it was copied in full.`,
      );
    }
    return { label, address: new ethers.Wallet(`0x${hex}`).address };
  });

if (newWallets.length !== 3) {
  throw new Error(
    `ORACLE_SOURCES should hold exactly 3 entries (CHIRPS, NASA_POWER, Meteostat), found ${newWallets.length}. ` +
      `Watch for stray commas.`,
  );
}

console.log(`Rotating oracles on ${deployer.address}`);
console.log(`  OracleAggregator: ${AGGREGATOR_ADDRESS}`);
console.log("");
console.log("New oracle addresses (from ORACLE_SOURCES):");
for (const { label, address } of newWallets) {
  const code = await ethers.provider.getCode(address);
  const balance = await ethers.provider.getBalance(address);
  const health = code === "0x" ? "clean" : "HAS EIP-7702 CODE - DO NOT USE";
  console.log(`  ${label.padEnd(12)} ${address}  ${ethers.formatEther(balance)} ETH  [${health}]`);
  if (code !== "0x") {
    throw new Error(`${label} at ${address} carries EIP-7702 delegation code; it is compromised.`);
  }
}
console.log("");

// ---------- Deactivate the obsolete sources ----------
async function retire(entries: { label: string; address: string }[], reason: string) {
  console.log(reason);
  for (const { label, address } of entries) {
    try {
      const tx = await aggregator.deactivateOracle(address);
      await tx.wait();
      console.log(`  Deactivated ${label} (${address.slice(0, 12)}...)`);
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      const text = `${err.reason ?? err.message ?? ""}`;
      if (text.includes("not registered")) {
        console.log(`  ${label} already deactivated, skipping`);
      } else {
        console.log(`  Failed to deactivate ${label}: ${text}`);
      }
    }
  }
}

await retire(COMPROMISED, "Deactivating compromised sources:");
await retire(DUPLICATE, "Deactivating superseded sources:");

// ---------- Register the replacement sources ----------
console.log("Registering replacement sources:");
for (const { label, address } of newWallets) {
  try {
    const tx = await aggregator.registerOracle(address, label, WEIGHTS[label] ?? 300n);
    await tx.wait();
    console.log(`  Registered ${label} (${address.slice(0, 12)}..., weight ${WEIGHTS[label] ?? 300n})`);
  } catch (e: unknown) {
    const err = e as { reason?: string; message?: string };
    const text = `${err.reason ?? err.message ?? ""}`;
    if (text.includes("already registered")) {
      console.log(`  ${label} already registered (${address.slice(0, 12)}...), skipping`);
    } else {
      console.log(`  Failed to register ${label}: ${text}`);
    }
  }
}

// ---------- Report the resulting state ----------
console.log("");
const active = await aggregator.activeOracleCount();
const quorum = await aggregator.minQuorum();
console.log(`Active oracles: ${active}, minQuorum: ${quorum}`);
console.log("");
console.log("Oracle rotation complete.");
console.log("Re-run the sepolia seed to submit readings from the new keys:");
console.log("  npx hardhat run scripts/seed-sepolia.ts --network sepolia");
