/**
 * Puts the deployed contracts into live operation with the relayer's own keys
 * from backend/.env:
 *
 *   1. registers each ORACLE_SOURCES account that isn't registered yet, with
 *      the weight its label has now;
 *   2. deactivates every other active oracle (e.g. the public Hardhat test
 *      accounts the first Sepolia seeding used);
 *   3. tops the insurance pool up to POOL_ETH (default 0.2);
 *   4. tops each oracle account and the KEEPER_PRIVATE_KEY account up to
 *      GAS_ETH (default 0.01) for gas.
 *
 * It only prints the plan unless GO_LIVE=yes, and it is safe to re-run: every
 * step checks the chain first and skips what's already done.
 *
 *   npm run go-live --workspace blockchain               # plan only
 *   GO_LIVE=yes npm run go-live --workspace blockchain   # apply
 *
 * BACKEND_ENV points at another env file, e.g. to rehearse on a local node:
 *   BACKEND_ENV=... npx hardhat run scripts/go-live.ts --network localhost
 */
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

const { ethers, networkName } = await network.create();
if (networkName !== "sepolia" && networkName !== "localhost") {
  throw new Error(`go-live targets sepolia (or localhost to rehearse), not "${networkName}"`);
}

const envFile = process.env.BACKEND_ENV ?? new URL("../../backend/.env", import.meta.url).pathname;
const envText = await readFile(envFile, "utf8");
const env = (key: string) => envText.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";

const apply = process.env.GO_LIVE === "yes";
const POOL_TARGET = ethers.parseEther(process.env.POOL_ETH ?? "0.2");
const GAS_TARGET = ethers.parseEther(process.env.GAS_ETH ?? "0.01");
// Weights for labels no active oracle has yet; the same as the first seeding.
const DEFAULT_WEIGHTS: Record<string, bigint> = { CHIRPS: 421n, NASA_POWER: 268n, Meteostat: 311n };

const sources = env("ORACLE_SOURCES")
  .split(",")
  .filter(Boolean)
  .map((entry) => {
    const [label, key] = entry.split(":").map((part) => part.trim());
    if (!label || !key) throw new Error(`ORACLE_SOURCES entry must be "label:private_key"`);
    return { label, address: new ethers.Wallet(key).address };
  });
if (sources.length === 0) throw new Error(`ORACLE_SOURCES is empty in ${envFile}`);
if (!env("KEEPER_PRIVATE_KEY")) throw new Error(`KEEPER_PRIVATE_KEY is empty in ${envFile}`);
const keeper = new ethers.Wallet(env("KEEPER_PRIVATE_KEY")).address;

const [owner] = await ethers.getSigners();
const aggregator = await ethers.getContractAt("OracleAggregator", env("ORACLE_AGGREGATOR_ADDRESS"));
const insuranceAddress = env("WEATHER_INDEX_INSURANCE_ADDRESS");
const insurance = await ethers.getContractAt("WeatherIndexInsurance", insuranceAddress);
if ((await aggregator.owner()) !== owner.address) {
  throw new Error(`${owner.address} doesn't own the OracleAggregator, so it can't register or deactivate oracles`);
}

// Accounts derived from Hardhat's public test mnemonic: anyone can sign as them.
const TEST_MNEMONIC = "test test test test test test test test test test test junk";
const publicTestAccounts = new Set(
  Array.from({ length: 20 }, (_, i) => ethers.HDNodeWallet.fromPhrase(TEST_MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).address),
);
const describe = (address: string) => (publicTestAccounts.has(address) ? `${address} (public Hardhat test key)` : address);

// ---------- Plan ----------
const current: Array<{ address: string; registered: boolean; label: string; weight: bigint }> = [];
for (let i = 0n; i < (await aggregator.getOracleCount()); i++) {
  const address = await aggregator.oracleList(i);
  const { registered, label, reputationWeight } = await aggregator.oracles(address);
  current.push({ address, registered, label, weight: reputationWeight });
}
const wanted = new Set(sources.map((s) => s.address));
const toRegister = sources.flatMap((source) => {
  const known = current.find((o) => o.address === source.address);
  if (known?.registered) return [];
  if (known) throw new Error(`${source.label} account ${source.address} was deactivated and can't be registered again; give it a new key`);
  const weight = current.find((o) => o.registered && o.label === source.label)?.weight ?? DEFAULT_WEIGHTS[source.label];
  if (!weight) throw new Error(`No reputation weight for "${source.label}"`);
  return [{ ...source, weight }];
});
const toDeactivate = current.filter((o) => o.registered && !wanted.has(o.address));
const activeAfter = current.filter((o) => o.registered).length + toRegister.length - toDeactivate.length;
const quorum = await aggregator.minQuorum();
if (BigInt(activeAfter) < quorum) throw new Error(`Only ${activeAfter} oracles would stay active, below the quorum of ${quorum}`);

const poolBalance = await ethers.provider.getBalance(insuranceAddress);
const poolTopUp = poolBalance < POOL_TARGET ? POOL_TARGET - poolBalance : 0n;
const gasTopUps: Array<{ label: string; address: string; amount: bigint }> = [];
for (const account of [...sources, { label: "keeper", address: keeper }]) {
  const balance = await ethers.provider.getBalance(account.address);
  if (balance < GAS_TARGET) gasTopUps.push({ ...account, amount: GAS_TARGET - balance });
}
const toSend = gasTopUps.reduce((sum, t) => sum + t.amount, poolTopUp);
const ownerBalance = await ethers.provider.getBalance(owner.address);

const eth = (wei: bigint) => `${ethers.formatEther(wei)} ETH`;
console.log(`Network ${networkName}; owner ${owner.address} has ${eth(ownerBalance)}\n`);
console.log("Oracles:");
for (const o of toRegister) console.log(`  register    ${o.label.padEnd(10)} ${o.address}  weight ${o.weight}`);
for (const o of toDeactivate) console.log(`  deactivate  ${o.label.padEnd(10)} ${describe(o.address)}`);
for (const o of current.filter((c) => c.registered && wanted.has(c.address))) {
  console.log(`  keep        ${o.label.padEnd(10)} ${o.address}  weight ${o.weight}`);
}
console.log(`  ${activeAfter} active afterwards, quorum ${quorum}\n`);
console.log(`Pool: ${eth(poolBalance)}${poolTopUp > 0n ? `, add ${eth(poolTopUp)}` : ", already funded"}`);
console.log("Gas:");
for (const t of gasTopUps) console.log(`  send ${eth(t.amount)} to ${t.label} ${t.address}`);
if (gasTopUps.length === 0) console.log("  every account already has enough");
console.log(`\nTotal to send: ${eth(toSend)} plus gas`);
if (toSend >= ownerBalance) throw new Error(`The owner has only ${eth(ownerBalance)}; lower POOL_ETH or GAS_ETH`);

if (!apply) {
  console.log("\nPlan only: nothing was sent. Re-run with GO_LIVE=yes to apply it.");
  process.exit(0);
}

// ---------- Apply ----------
// Register first, so the active count never drops below the quorum in between.
for (const o of toRegister) {
  await (await aggregator.registerOracle(o.address, o.label, o.weight)).wait();
  console.log(`Registered ${o.label} ${o.address}`);
}
for (const o of toDeactivate) {
  await (await aggregator.deactivateOracle(o.address)).wait();
  console.log(`Deactivated ${o.label} ${o.address}`);
}
if (poolTopUp > 0n) {
  await (await insurance.fundPool({ value: poolTopUp })).wait();
  console.log(`Funded the pool with ${eth(poolTopUp)}`);
}
for (const t of gasTopUps) {
  await (await owner.sendTransaction({ to: t.address, value: t.amount })).wait();
  console.log(`Sent ${eth(t.amount)} to ${t.label} ${t.address}`);
}
console.log("\nDone. Set RELAYER_ENABLED=true in backend/.env and restart the backend to start reporting and settling.");
