import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

// A two-dekad coverage window: 1-10 and 11-20 July 2026.
const JUL_D1 = 2026071;
const JUL_D2 = 2026072;
const DROUGHT_THRESHOLD_MM = 3000; // 30.00mm over the window, scaled by 100
const PAYOUT = ethers.parseEther("1");

async function deployFixture() {
  const [, farmer, chirps, nasaPower, meteostat] = await ethers.getSigners();

  const aggregator = await ethers.deployContract("OracleAggregator");
  await aggregator.registerOracle(chirps.address, "CHIRPS", 50);
  await aggregator.registerOracle(nasaPower.address, "NASA_POWER", 30);
  await aggregator.registerOracle(meteostat.address, "Meteostat", 20);

  const insurance = await ethers.deployContract("WeatherIndexInsurance", [
    await aggregator.getAddress(),
  ]);
  await insurance.fundPool({ value: ethers.parseEther("5") });

  const salesCloseAt = (await networkHelpers.time.latest()) + 86_400;
  await insurance.addCoverageWindow([JUL_D1, JUL_D2], salesCloseAt);

  const premium = await insurance.quotePremium(PAYOUT);
  await insurance.connect(farmer).buyPolicy(0, DROUGHT_THRESHOLD_MM, PAYOUT, { value: premium });

  return { aggregator, insurance, farmer, chirps, nasaPower, meteostat, premium, salesCloseAt };
}

describe("Weather-indexed micro-insurance: purchase, aggregation and payout", function () {
  it("collects the farmer's premium into the pool and reserves the payout", async function () {
    const { insurance, farmer, premium } = await networkHelpers.loadFixture(deployFixture);

    expect(premium).to.equal(ethers.parseEther("0.1")); // default 10% rate
    expect(await ethers.provider.getBalance(await insurance.getAddress())).to.equal(
      ethers.parseEther("5") + premium,
    );
    expect(await insurance.reservedPayouts()).to.equal(PAYOUT);
    const policy = await insurance.policies(0);
    expect(policy.farmer).to.equal(farmer.address);
  });

  it("stops selling cover once the window's sales deadline has passed", async function () {
    const { insurance, farmer, premium, salesCloseAt } = await networkHelpers.loadFixture(deployFixture);

    await networkHelpers.time.increaseTo(salesCloseAt);
    await expect(
      insurance.connect(farmer).buyPolicy(0, DROUGHT_THRESHOLD_MM, PAYOUT, { value: premium }),
    ).to.be.revertedWith("WeatherIndexInsurance: sales closed for window");
  });

  it("pays out the farmer when the window's reputation-weighted rainfall is below the drought threshold", async function () {
    const { aggregator, insurance, farmer, chirps, nasaPower, meteostat } =
      await networkHelpers.loadFixture(deployFixture);

    for (const period of [JUL_D1, JUL_D2]) {
      await aggregator.connect(chirps).submitReading(period, 1000);
      await aggregator.connect(nasaPower).submitReading(period, 1400);
      await aggregator.connect(meteostat).submitReading(period, 1800);
      await aggregator.finalizePeriod(period); // weighted aggregate = 1280 per dekad
    }

    expect(await insurance.windowRainfall(0)).to.equal(2560); // below 3000
    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, PAYOUT);
    expect(await insurance.reservedPayouts()).to.equal(0n);
  });

  it("does not pay out when the window's weighted rainfall is above the drought threshold", async function () {
    const { aggregator, insurance, farmer, chirps, nasaPower, meteostat } =
      await networkHelpers.loadFixture(deployFixture);

    for (const period of [JUL_D1, JUL_D2]) {
      await aggregator.connect(chirps).submitReading(period, 2000);
      await aggregator.connect(nasaPower).submitReading(period, 2200);
      await aggregator.connect(meteostat).submitReading(period, 2400);
      await aggregator.finalizePeriod(period); // 2140 per dekad, 4280 over the window
    }

    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, 0n);
    expect(await insurance.reservedPayouts()).to.equal(0n);
  });

  it("still reaches a usable, correctly-weighted estimate if one oracle source never reports", async function () {
    const { aggregator, insurance, farmer, chirps, nasaPower } =
      await networkHelpers.loadFixture(deployFixture);

    // Meteostat is offline for the whole window
    for (const period of [JUL_D1, JUL_D2]) {
      await aggregator.connect(chirps).submitReading(period, 1000);
      await aggregator.connect(nasaPower).submitReading(period, 1400);
      await aggregator.finalizePeriod(period); // (50*1000 + 30*1400) / 80 = 1150
    }

    expect(await aggregator.finalizedAggregate(JUL_D1)).to.equal(1150);
    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, PAYOUT);
  });

  it("only pays out once per policy, even if settlement is attempted twice", async function () {
    const { aggregator, insurance, chirps } = await networkHelpers.loadFixture(deployFixture);

    for (const period of [JUL_D1, JUL_D2]) {
      await aggregator.connect(chirps).submitReading(period, 1000);
      await aggregator.finalizePeriod(period);
    }

    await insurance.checkAndSettle(0);

    await expect(insurance.checkAndSettle(0)).to.be.revertedWith(
      "WeatherIndexInsurance: already settled",
    );
  });

  it("refuses to settle until every dekad in the window is finalized", async function () {
    const { aggregator, insurance, chirps } = await networkHelpers.loadFixture(deployFixture);

    await aggregator.connect(chirps).submitReading(JUL_D1, 1000);
    await aggregator.finalizePeriod(JUL_D1); // JUL_D2 still open

    await expect(insurance.checkAndSettle(0)).to.be.revertedWith(
      "WeatherIndexInsurance: window not finalized yet",
    );
  });
});
