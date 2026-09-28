import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const PERIOD = 1;
const DROUGHT_THRESHOLD_MM = 1500; // 15.00mm, scaled by 100
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
  await insurance.createPolicy(farmer.address, PERIOD, DROUGHT_THRESHOLD_MM, PAYOUT);

  return { aggregator, insurance, farmer, chirps, nasaPower, meteostat };
}

describe("Weather-indexed micro-insurance: aggregator + payout flow", function () {
  it("pays out the farmer when the reputation-weighted rainfall estimate is below the drought threshold", async function () {
    const { aggregator, insurance, farmer, chirps, nasaPower, meteostat } =
      await networkHelpers.loadFixture(deployFixture);

    await aggregator.connect(chirps).submitReading(PERIOD, 1000);
    await aggregator.connect(nasaPower).submitReading(PERIOD, 1400);
    await aggregator.connect(meteostat).submitReading(PERIOD, 1800);
    await aggregator.finalizePeriod(PERIOD); // weighted aggregate = 1280, below 1500

    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, PAYOUT);
  });

  it("does not pay out when the weighted rainfall estimate is above the drought threshold", async function () {
    const { aggregator, insurance, farmer, chirps, nasaPower, meteostat } =
      await networkHelpers.loadFixture(deployFixture);

    await aggregator.connect(chirps).submitReading(PERIOD, 2000);
    await aggregator.connect(nasaPower).submitReading(PERIOD, 2200);
    await aggregator.connect(meteostat).submitReading(PERIOD, 2400);
    await aggregator.finalizePeriod(PERIOD); // weighted aggregate well above 1500

    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, 0n);
  });

  it("still reaches a usable, correctly-weighted estimate if one oracle source never reports", async function () {
    const { aggregator, insurance, farmer, chirps, nasaPower } =
      await networkHelpers.loadFixture(deployFixture);

    // Meteostat is offline this period
    await aggregator.connect(chirps).submitReading(PERIOD, 1000);
    await aggregator.connect(nasaPower).submitReading(PERIOD, 1400);
    await aggregator.finalizePeriod(PERIOD); // (50*1000 + 30*1400) / 80 = 1150, below threshold

    expect(await aggregator.finalizedAggregate(PERIOD)).to.equal(1150);
    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, PAYOUT);
  });

  it("only pays out once per policy, even if settlement is attempted twice", async function () {
    const { aggregator, insurance, chirps, nasaPower, meteostat } =
      await networkHelpers.loadFixture(deployFixture);

    await aggregator.connect(chirps).submitReading(PERIOD, 1000);
    await aggregator.connect(nasaPower).submitReading(PERIOD, 1400);
    await aggregator.connect(meteostat).submitReading(PERIOD, 1800);
    await aggregator.finalizePeriod(PERIOD);

    await insurance.checkAndSettle(0);

    await expect(insurance.checkAndSettle(0)).to.be.revertedWith(
      "WeatherIndexInsurance: already claimed",
    );
  });

  it("refuses to settle before the aggregator has finalized the period", async function () {
    const { insurance } = await networkHelpers.loadFixture(deployFixture);

    await expect(insurance.checkAndSettle(0)).to.be.revertedWith(
      "WeatherIndexInsurance: period not finalized yet",
    );
  });
});
