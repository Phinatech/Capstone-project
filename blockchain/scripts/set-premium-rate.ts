/**
 * Sets the premium the insurance contract charges, in basis points of the
 * payout (1750 = 17.5%). Only the owner can change it. It prices policies sold
 * from then on; policies already sold keep the premium they paid.
 *
 * Why 17.5%: cover now pays when a window's rainfall ends below the level it
 * fell short of in about 1 year in 10 at Sokoto since 1981
 * (frontend/src/utils/coverLevels.ts). That is 5 of 44 years, about 11.4%, so
 * on average each policy pays out 11.4% of its payout a year. Aiming for
 * payouts of 65% of premiums, the rest covering the agent's 10% commission,
 * running costs and a margin: 11.4% / 0.65 = 17.5%.
 *
 * The app reads the rate from the contract, so the buy forms show the new
 * price as soon as the transaction lands.
 *
 * It only prints the change unless APPLY=yes, and reads the contract address
 * from backend/.env (WEATHER_INDEX_INSURANCE_ADDRESS), nothing else from it:
 *
 *   RATE_BPS=1750 npm run premium-rate --workspace blockchain             # plan only
 *   APPLY=yes RATE_BPS=1750 npm run premium-rate --workspace blockchain   # send it
 */
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

const { ethers, networkName } = await network.create();
if (networkName !== "sepolia" && networkName !== "localhost") {
  throw new Error(`set-premium-rate targets sepolia (or localhost to rehearse), not "${networkName}"`);
}

const rateBps = Number(process.env.RATE_BPS ?? "1750");
if (!Number.isInteger(rateBps) || rateBps <= 0 || rateBps > 10_000) {
  throw new Error(`RATE_BPS must be a whole number from 1 to 10000 (1750 = 17.5%), not "${process.env.RATE_BPS}"`);
}

const envFile = process.env.BACKEND_ENV ?? new URL("../../backend/.env", import.meta.url).pathname;
const address = (await readFile(envFile, "utf8")).match(/^WEATHER_INDEX_INSURANCE_ADDRESS=(.*)$/m)?.[1]?.trim();
if (!address || !ethers.isAddress(address)) throw new Error(`WEATHER_INDEX_INSURANCE_ADDRESS is missing from ${envFile}`);

const [signer] = await ethers.getSigners();
const insurance = await ethers.getContractAt("WeatherIndexInsurance", address);
const owner = await insurance.owner();
const current = await insurance.premiumRateBps();
const pct = (bps: bigint | number) => `${Number(bps) / 100}%`;

console.log(`WeatherIndexInsurance ${address} on ${networkName}`);
console.log(`  premium now:  ${pct(current)} of the payout`);
console.log(`  premium next: ${pct(rateBps)} of the payout`);
console.log(`  e.g. a 2.5 ha farm (0.025 ETH payout) would pay ${ethers.formatEther(await insurance.quotePremium(ethers.parseEther("0.025")))} ETH now`);

if (current === BigInt(rateBps)) {
  console.log("Nothing to do: the contract already charges that rate.");
} else if (owner.toLowerCase() !== signer.address.toLowerCase()) {
  throw new Error(`${signer.address} doesn't own the contract (${owner} does), so it can't change the premium`);
} else if (process.env.APPLY !== "yes") {
  console.log("Plan only. Run again with APPLY=yes to send the transaction.");
} else {
  const tx = await insurance.setPremiumRate(rateBps);
  console.log(`  sent ${tx.hash}, waiting for it to be mined…`);
  await tx.wait();
  const after = await insurance.quotePremium(ethers.parseEther("0.025"));
  console.log(`Done: the premium is ${pct(await insurance.premiumRateBps())}; that 2.5 ha farm now pays ${ethers.formatEther(after)} ETH.`);
}
