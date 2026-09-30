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

type Fixture = Awaited<ReturnType<typeof deployFixture>>;

/** All three sources report the same values for a dekad, which then finalizes at once. */
async function reportAll(f: Fixture, period: number, [c, n, m]: [number, number, number]) {
  await f.aggregator.connect(f.chirps).submitReading(period, c);
  await f.aggregator.connect(f.nasaPower).submitReading(period, n);
  await f.aggregator.connect(f.meteostat).submitReading(period, m);
  await f.aggregator.finalizePeriod(period);
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
    }
    // Two of three sources meet the quorum, but finalizing waits out the reporting window.
    await expect(aggregator.finalizePeriod(JUL_D1)).to.be.revertedWith(
      "OracleAggregator: reporting window still open",
    );
    await networkHelpers.time.increase(await aggregator.reportingWindow());
    for (const period of [JUL_D1, JUL_D2]) {
      await aggregator.finalizePeriod(period); // (50*1000 + 30*1400) / 80 = 1150
    }

    expect(await aggregator.finalizedAggregate(JUL_D1)).to.equal(1150);
    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, PAYOUT);
  });

  it("only pays out once per policy, even if settlement is attempted twice", async function () {
    const f = await networkHelpers.loadFixture(deployFixture);
    const { insurance } = f;

    for (const period of [JUL_D1, JUL_D2]) await reportAll(f, period, [1000, 1000, 1000]);

    await insurance.checkAndSettle(0);

    await expect(insurance.checkAndSettle(0)).to.be.revertedWith(
      "WeatherIndexInsurance: already settled",
    );
  });

  it("refuses to settle until every dekad in the window is finalized", async function () {
    const f = await networkHelpers.loadFixture(deployFixture);
    const { insurance } = f;

    await reportAll(f, JUL_D1, [1000, 1000, 1000]); // JUL_D2 still open

    await expect(insurance.checkAndSettle(0)).to.be.revertedWith(
      "WeatherIndexInsurance: window not finalized yet",
    );
  });

  it("won't let one source finalize an extreme early reading into a payout (audit M-1)", async function () {
    const f = await networkHelpers.loadFixture(deployFixture);
    const { aggregator, insurance, farmer, meteostat } = f;

    // Meteostat's key reports 1 mm for the first dekad and tries to lock it in
    // before CHIRPS and NASA POWER report; the farmer's policy pays below 30 mm.
    await aggregator.connect(meteostat).submitReading(JUL_D1, 100);
    await expect(aggregator.connect(meteostat).finalizePeriod(JUL_D1)).to.be.revertedWith(
      "OracleAggregator: quorum not reached",
    );

    // Honest sources then report a normal July for the rest of that dekad and the next.
    await aggregator.connect(f.chirps).submitReading(JUL_D1, 2000);
    await aggregator.connect(f.nasaPower).submitReading(JUL_D1, 2200);
    await aggregator.finalizePeriod(JUL_D1); // (50*2000 + 30*2200 + 20*100) / 100 = 1680
    await reportAll(f, JUL_D2, [2000, 2200, 2400]); // 2140

    expect(await insurance.windowRainfall(0)).to.equal(3820); // above 3000: no drought
    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, 0n);
  });

  it("ignores reputation changes made after a dekad's readings started (audit M-2)", async function () {
    const f = await networkHelpers.loadFixture(deployFixture);
    const { aggregator, insurance, farmer, chirps, nasaPower, meteostat } = f;

    // Both dekads open with CHIRPS' reading, fixing their weights at 50 / 30 / 20.
    await aggregator.connect(chirps).submitReading(JUL_D1, 2000);
    await aggregator.connect(chirps).submitReading(JUL_D2, 2000);

    // The owner then boosts Meteostat, whose low reading would tip the policy
    // into a payout: (50*2000 + 30*1800 + 1000*200) / 1080 = 327 per dekad.
    await aggregator.updateReputation(meteostat.address, 1000);

    for (const period of [JUL_D1, JUL_D2]) {
      await aggregator.connect(nasaPower).submitReading(period, 1800);
      await aggregator.connect(meteostat).submitReading(period, 200);
      await aggregator.finalizePeriod(period); // (50*2000 + 30*1800 + 20*200) / 100 = 1580
    }

    expect((await aggregator.oracles(meteostat.address)).reputationWeight).to.equal(1000n);
    expect(await aggregator.weightForPeriod(JUL_D1, meteostat.address)).to.equal(20n);
    expect(await insurance.windowRainfall(0)).to.equal(3160); // above 3000: no drought
    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, 0n);
  });

  it("hands both contracts to a new owner in two steps (audit L-3)", async function () {
    const { aggregator, insurance, chirps } = await networkHelpers.loadFixture(deployFixture);
    const [deployer, , , , , , multisig] = await ethers.getSigners();

    for (const contract of [aggregator, insurance]) {
      await expect(contract.transferOwnership(multisig.address))
        .to.emit(contract, "OwnershipTransferStarted")
        .withArgs(deployer.address, multisig.address);
      expect(await contract.owner()).to.equal(deployer.address); // not until accepted
      await expect(contract.connect(multisig).acceptOwnership())
        .to.emit(contract, "OwnershipTransferred")
        .withArgs(deployer.address, multisig.address);
      expect(await contract.owner()).to.equal(multisig.address);
    }

    // The deployer key can no longer run either contract; the new owner can.
    const salesCloseAt = (await networkHelpers.time.latest()) + 86_400;
    await expect(insurance.addCoverageWindow([JUL_D1], salesCloseAt)).to.be.revertedWith(
      "WeatherIndexInsurance: caller is not owner",
    );
    await expect(aggregator.updateReputation(chirps.address, 99)).to.be.revertedWith(
      "OracleAggregator: caller is not owner",
    );
    await insurance.connect(multisig).addCoverageWindow([JUL_D1], salesCloseAt);
    await aggregator.connect(multisig).updateReputation(chirps.address, 99);
  });

  it("switches off a compromised source without losing its history (audit L-5)", async function () {
    const f = await networkHelpers.loadFixture(deployFixture);
    const { aggregator, insurance, farmer, chirps, nasaPower, meteostat } = f;

    // Meteostat's relayer key leaks before July reporting starts.
    await expect(aggregator.deactivateOracle(meteostat.address))
      .to.emit(aggregator, "OracleDeactivated")
      .withArgs(meteostat.address, "Meteostat", 20);
    await expect(aggregator.connect(meteostat).submitReading(JUL_D1, 0)).to.be.revertedWith(
      "OracleAggregator: not a registered oracle",
    );

    // The two remaining sources are every active source, so each dekad
    // finalizes as soon as both have reported.
    for (const period of [JUL_D1, JUL_D2]) {
      await aggregator.connect(chirps).submitReading(period, 1000);
      await aggregator.connect(nasaPower).submitReading(period, 1400);
      await aggregator.finalizePeriod(period); // (50*1000 + 30*1400) / 80 = 1150
    }
    expect(await insurance.windowRainfall(0)).to.equal(2300);
    await expect(insurance.checkAndSettle(0)).to.changeEtherBalance(ethers, farmer, PAYOUT);

    const history = await aggregator.oracles(meteostat.address);
    expect([history.registered, history.label, history.reputationWeight]).to.deep.equal([false, "Meteostat", 20n]);
  });
});

