// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {OracleAggregator} from "./OracleAggregator.sol";

contract OracleAggregatorTest is Test {
    OracleAggregator aggregator;

    address chirps = address(0x1001);
    address nasaPower = address(0x1002);
    address meteostat = address(0x1003);
    address stranger = address(0x1004);

    uint256 constant PERIOD = 1;

    function setUp() public {
        aggregator = new OracleAggregator();
        aggregator.registerOracle(chirps, "CHIRPS", 50);
        aggregator.registerOracle(nasaPower, "NASA_POWER", 30);
        aggregator.registerOracle(meteostat, "Meteostat", 20);
    }

    function test_WeightsSourcesByReputation() public {
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, 1800);

        aggregator.finalizePeriod(PERIOD);

        // (50*1000 + 30*1400 + 20*1800) / 100 = 1280
        require(aggregator.finalizedAggregate(PERIOD) == 1280, "unexpected weighted aggregate");
    }

    function test_MissingSourceDoesNotSkewResultTowardZero() public {
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);
        // meteostat does not report this period, so finalizing waits out the window
        vm.warp(block.timestamp + aggregator.reportingWindow());

        aggregator.finalizePeriod(PERIOD);

        // (50*1000 + 30*1400) / 80 = 1150 — a plain average of the two
        // sources that reported, not diluted by the missing third weight
        require(aggregator.finalizedAggregate(PERIOD) == 1150, "missing source skewed the result");
    }

    function test_RevertsOnDuplicateSubmissionForSamePeriod() public {
        vm.startPrank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.expectRevert(bytes("OracleAggregator: already submitted for period"));
        aggregator.submitReading(PERIOD, 1200);
        vm.stopPrank();
    }

    function test_RevertsOnDoubleFinalization() public {
        _reportAll(1000, 1000, 1000);
        aggregator.finalizePeriod(PERIOD);

        vm.expectRevert(bytes("OracleAggregator: already finalized"));
        aggregator.finalizePeriod(PERIOD);
    }

    function test_RevertsFinalizingPeriodWithNoReadings() public {
        vm.expectRevert(bytes("OracleAggregator: no readings submitted"));
        aggregator.finalizePeriod(PERIOD);
    }

    function test_OnlyOwnerCanRegisterOracles() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("OracleAggregator: caller is not owner"));
        aggregator.registerOracle(stranger, "ROGUE", 1000);
    }

    function test_OnlyOwnerCanUpdateReputation() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("OracleAggregator: caller is not owner"));
        aggregator.updateReputation(chirps, 99);
    }

    function test_UnregisteredSourceCannotSubmit() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("OracleAggregator: not a registered oracle"));
        aggregator.submitReading(PERIOD, 1000);
    }

    // ---------- Deactivation (audit L-5) ----------

    event OracleDeactivated(address indexed oracle, string label, uint256 lastWeight);

    function test_DeactivatedOracleCannotReportButKeepsItsHistory() public {
        vm.expectEmit(true, false, false, true, address(aggregator));
        emit OracleDeactivated(meteostat, "Meteostat", 20);
        aggregator.deactivateOracle(meteostat);

        vm.prank(meteostat);
        vm.expectRevert(bytes("OracleAggregator: not a registered oracle"));
        aggregator.submitReading(PERIOD, 1800);

        (bool registered, string memory label, uint256 weight) = aggregator.oracles(meteostat);
        assertFalse(registered);
        assertEq(label, "Meteostat");
        assertEq(weight, 20);
        assertEq(aggregator.deactivatedAt(meteostat), block.timestamp);
        assertEq(aggregator.getOracleCount(), 3); // still listed
        assertEq(aggregator.activeOracleCount(), 2);
    }

    function test_DeactivatedOracleIsLeftOutOfNewPeriods() public {
        aggregator.deactivateOracle(meteostat);
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);

        assertEq(aggregator.weightForPeriod(PERIOD, meteostat), 0);
        assertEq(aggregator.periodOracleCount(PERIOD), 2);
        // Both active sources are in, so no need to wait out the window.
        aggregator.finalizePeriod(PERIOD);
        assertEq(aggregator.finalizedAggregate(PERIOD), 1150); // (50*1000 + 30*1400) / 80
    }

    /// @dev Readings already submitted for a period still reporting keep
    ///      counting, so deactivation can't change a period under way (M-2).
    function test_ReadingsSubmittedBeforeDeactivationStillCount() public {
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, 1800);
        aggregator.deactivateOracle(meteostat);
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);

        aggregator.finalizePeriod(PERIOD);
        assertEq(aggregator.finalizedAggregate(PERIOD), 1280); // Meteostat's 1800 at weight 20 included
    }

    function test_DeactivationMidPeriodBeforeReportingWaitsOutTheWindow() public {
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000); // snapshot includes Meteostat
        aggregator.deactivateOracle(meteostat);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);

        vm.prank(meteostat);
        vm.expectRevert(bytes("OracleAggregator: not a registered oracle"));
        aggregator.submitReading(PERIOD, 1800);

        // Not every source in the period's snapshot has reported, so it waits.
        vm.expectRevert(bytes("OracleAggregator: reporting window still open"));
        aggregator.finalizePeriod(PERIOD);
        vm.warp(block.timestamp + aggregator.reportingWindow());
        aggregator.finalizePeriod(PERIOD);
        assertEq(aggregator.finalizedAggregate(PERIOD), 1150);
    }

    function test_DeactivatedOracleCannotBeReregisteredReweightedOrDeactivatedAgain() public {
        aggregator.deactivateOracle(meteostat);
        vm.expectRevert(bytes("OracleAggregator: oracle was deactivated"));
        aggregator.registerOracle(meteostat, "Meteostat v2", 99);
        vm.expectRevert(bytes("OracleAggregator: not registered"));
        aggregator.updateReputation(meteostat, 99);
        vm.expectRevert(bytes("OracleAggregator: not registered"));
        aggregator.deactivateOracle(meteostat);

        // A replacement feed registers under a fresh address instead.
        aggregator.registerOracle(address(0x1006), "Meteostat v2", 20);
        assertEq(aggregator.activeOracleCount(), 3);
        assertEq(aggregator.getOracleCount(), 4);
    }

    function test_OnlyOwnerCanDeactivate() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("OracleAggregator: caller is not owner"));
        aggregator.deactivateOracle(chirps);
    }

    function test_QuorumBoundTracksActiveOracles() public {
        aggregator.setMinQuorum(3);
        aggregator.deactivateOracle(meteostat);
        vm.expectRevert(bytes("OracleAggregator: quorum exceeds active oracles"));
        aggregator.setMinQuorum(3);
        aggregator.setMinQuorum(2);
        assertEq(aggregator.minQuorum(), 2);
    }

    // ---------- Two-step ownership (audit L-3) ----------

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function test_TwoStepOwnershipTransfer() public {
        address multisig = address(0x3001);

        vm.expectEmit(true, true, false, false, address(aggregator));
        emit OwnershipTransferStarted(address(this), multisig);
        aggregator.transferOwnership(multisig);
        assertEq(aggregator.owner(), address(this)); // unchanged until accepted
        assertEq(aggregator.pendingOwner(), multisig);

        vm.expectEmit(true, true, false, false, address(aggregator));
        emit OwnershipTransferred(address(this), multisig);
        vm.prank(multisig);
        aggregator.acceptOwnership();
        assertEq(aggregator.owner(), multisig);
        assertEq(aggregator.pendingOwner(), address(0));

        // The old owner is locked out and the new one has its powers (reweighting a source).
        vm.expectRevert(bytes("OracleAggregator: caller is not owner"));
        aggregator.updateReputation(chirps, 99);
        vm.prank(multisig);
        aggregator.updateReputation(chirps, 99);
    }

    function test_OnlyOwnerCanStartATransfer() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("OracleAggregator: caller is not owner"));
        aggregator.transferOwnership(stranger);
    }

    function test_OnlyThePendingOwnerCanAccept() public {
        address multisig = address(0x3001);
        aggregator.transferOwnership(multisig);

        vm.prank(stranger);
        vm.expectRevert(bytes("OracleAggregator: caller is not pending owner"));
        aggregator.acceptOwnership();
        vm.expectRevert(bytes("OracleAggregator: caller is not pending owner"));
        aggregator.acceptOwnership(); // not even the current owner
        assertEq(aggregator.owner(), address(this));
    }

    function test_PendingTransferCanBeRedirectedOrCancelled() public {
        address first = address(0x3001);
        address second = address(0x3002);
        aggregator.transferOwnership(first);
        aggregator.transferOwnership(second); // redirect
        vm.prank(first);
        vm.expectRevert(bytes("OracleAggregator: caller is not pending owner"));
        aggregator.acceptOwnership();

        aggregator.transferOwnership(address(0)); // cancel
        assertEq(aggregator.pendingOwner(), address(0));
        vm.prank(second);
        vm.expectRevert(bytes("OracleAggregator: caller is not pending owner"));
        aggregator.acceptOwnership();
        assertEq(aggregator.owner(), address(this));
    }

    // ---------- Plausibility bound (audit M-5) ----------

    function test_AcceptsReadingsUpToTheBound() public {
        uint256 max = aggregator.MAX_READING(); // read before prank: it applies to the next call only
        assertEq(max, 50_000); // 500.00 mm
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 0);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, max); // inclusive
    }

    function test_RejectsImplausibleReadings() public {
        vm.startPrank(chirps);
        vm.expectRevert(bytes("OracleAggregator: reading out of range"));
        aggregator.submitReading(PERIOD, 50_001);
        // A mm value sent without the x100 scaling can't be caught, but one
        // scaled twice (e.g. 120 mm -> 1_200_000) is.
        vm.expectRevert(bytes("OracleAggregator: reading out of range"));
        aggregator.submitReading(PERIOD, 1_200_000);
        vm.expectRevert(bytes("OracleAggregator: reading out of range"));
        aggregator.submitReading(PERIOD, type(uint256).max);
        vm.stopPrank();

        // A rejected reading doesn't count as the source's submission.
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
    }

    function testFuzz_EveryReadingAboveTheBoundIsRejected(uint256 rainfallMm) public {
        rainfallMm = bound(rainfallMm, aggregator.MAX_READING() + 1, type(uint256).max);
        vm.prank(meteostat);
        vm.expectRevert(bytes("OracleAggregator: reading out of range"));
        aggregator.submitReading(PERIOD, rainfallMm);
    }

    // ---------- Finalization guard (audit M-1) ----------

    /// @dev The audit's attack: one source reports an extreme value and
    ///      finalizes before the honest sources have reported.
    function test_SingleEarlyReadingCannotBeFinalized() public {
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, 100); // 1 mm
        vm.prank(meteostat);
        vm.expectRevert(bytes("OracleAggregator: quorum not reached"));
        aggregator.finalizePeriod(PERIOD);

        // Waiting out the window doesn't help a lone reading either.
        vm.warp(block.timestamp + aggregator.reportingWindow());
        vm.expectRevert(bytes("OracleAggregator: quorum not reached"));
        aggregator.finalizePeriod(PERIOD);

        // Once the honest sources report, their weight outvotes it.
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 3000);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 3200);
        aggregator.finalizePeriod(PERIOD);
        // (50*3000 + 30*3200 + 20*100) / 100 = 2480, not 100
        assertEq(aggregator.finalizedAggregate(PERIOD), 2480);
    }

    function test_QuorumWithoutAllSourcesWaitsForTheReportingWindow() public {
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, 100);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 150);

        vm.expectRevert(bytes("OracleAggregator: reporting window still open"));
        aggregator.finalizePeriod(PERIOD);

        vm.warp(block.timestamp + aggregator.reportingWindow() - 1);
        vm.expectRevert(bytes("OracleAggregator: reporting window still open"));
        aggregator.finalizePeriod(PERIOD);

        vm.warp(block.timestamp + 1);
        aggregator.finalizePeriod(PERIOD);
        assertTrue(aggregator.isFinalized(PERIOD));
    }

    function test_FinalizesImmediatelyOnceEverySourceHasReported() public {
        _reportAll(1000, 1400, 1800);
        aggregator.finalizePeriod(PERIOD); // no warp needed
        assertEq(aggregator.finalizedAggregate(PERIOD), 1280);
    }

    function test_WindowOpensAtTheFirstReadingNotBefore() public {
        vm.warp(block.timestamp + 10 days); // idle time before anyone reports doesn't count
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);
        assertEq(aggregator.firstReadingAt(PERIOD), block.timestamp);

        vm.expectRevert(bytes("OracleAggregator: reporting window still open"));
        aggregator.finalizePeriod(PERIOD);
    }

    function test_LateReadingAfterFinalizationIsRejected() public {
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);
        vm.warp(block.timestamp + aggregator.reportingWindow());
        aggregator.finalizePeriod(PERIOD);

        vm.prank(meteostat);
        vm.expectRevert(bytes("OracleAggregator: period already finalized"));
        aggregator.submitReading(PERIOD, 1800);
    }

    function test_OwnerCanTuneQuorumAndWindowWithinBounds() public {
        aggregator.setMinQuorum(3);
        assertEq(aggregator.minQuorum(), 3);
        vm.expectRevert(bytes("OracleAggregator: quorum exceeds active oracles"));
        aggregator.setMinQuorum(4);
        vm.expectRevert(bytes("OracleAggregator: quorum must be positive"));
        aggregator.setMinQuorum(0);

        aggregator.setReportingWindow(6 hours);
        assertEq(aggregator.reportingWindow(), 6 hours);
        vm.expectRevert(bytes("OracleAggregator: window too long"));
        aggregator.setReportingWindow(31 days);
    }

    function test_OnlyOwnerCanTuneQuorumAndWindow() public {
        vm.startPrank(stranger);
        vm.expectRevert(bytes("OracleAggregator: caller is not owner"));
        aggregator.setMinQuorum(1);
        vm.expectRevert(bytes("OracleAggregator: caller is not owner"));
        aggregator.setReportingWindow(0);
        vm.stopPrank();
    }

    /// @dev Liveness: if sources go offline for good, the owner can lower the
    ///      quorum so the period (and the policies waiting on it) can settle.
    function test_LoweringQuorumRecoversAPeriodWithOneSurvivingSource() public {
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        vm.warp(block.timestamp + aggregator.reportingWindow());
        vm.expectRevert(bytes("OracleAggregator: quorum not reached"));
        aggregator.finalizePeriod(PERIOD);

        aggregator.setMinQuorum(1);
        aggregator.finalizePeriod(PERIOD);
        assertEq(aggregator.finalizedAggregate(PERIOD), 1000);
    }

    // ---------- Weight snapshots (audit M-2) ----------

    function test_AggregateUsesWeightsLiveWhenThePeriodStarted() public {
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000); // snapshots 50 / 30 / 20
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);

        // The owner reweights with readings already in, before finalization.
        aggregator.updateReputation(meteostat, 500);
        aggregator.updateReputation(chirps, 1);
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, 1800);
        aggregator.finalizePeriod(PERIOD);

        // Still (50*1000 + 30*1400 + 20*1800) / 100 = 1280. With the new
        // weights it would have been (1*1000 + 30*1400 + 500*1800) / 531 = 1775.
        assertEq(aggregator.finalizedAggregate(PERIOD), 1280);
        assertEq(aggregator.weightForPeriod(PERIOD, meteostat), 20);
        assertEq(aggregator.weightForPeriod(PERIOD, chirps), 50);
        (,, uint256 liveMeteostat) = aggregator.oracles(meteostat);
        assertEq(liveMeteostat, 500);
    }

    function test_WeightUpdateAppliesFromTheNextPeriod() public {
        aggregator.updateReputation(meteostat, 500); // before PERIOD's first reading
        _reportAll(1000, 1400, 1800);
        aggregator.finalizePeriod(PERIOD);
        // (50*1000 + 30*1400 + 500*1800) / 580 = 1710
        assertEq(aggregator.finalizedAggregate(PERIOD), 1710);
    }

    function test_SourceRegisteredMidPeriodCannotReportForIt() public {
        address newcomer = address(0x1005);
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
        aggregator.registerOracle(newcomer, "NEWCOMER", 1000);
        assertEq(aggregator.weightForPeriod(PERIOD, newcomer), 0);

        vm.prank(newcomer);
        vm.expectRevert(bytes("OracleAggregator: registered after period opened"));
        aggregator.submitReading(PERIOD, 0);

        // The three original sources are "everyone" for this period, so it
        // still finalizes as soon as they have all reported.
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, 1400);
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, 1800);
        aggregator.finalizePeriod(PERIOD);
        assertEq(aggregator.finalizedAggregate(PERIOD), 1280);

        // It takes part from the next period on.
        vm.prank(newcomer);
        aggregator.submitReading(PERIOD + 1, 900);
        assertEq(aggregator.weightForPeriod(PERIOD + 1, newcomer), 1000);
    }

    /// @dev However the owner reweights after a period's first reading, the
    ///      period's aggregate matches the one computed with its start weights.
    function testFuzz_ReweightingAfterFirstReadingNeverChangesTheAggregate(
        uint32 r1,
        uint32 r2,
        uint32 r3,
        uint16 w1,
        uint16 w2,
        uint16 w3
    ) public {
        r1 = uint32(bound(r1, 0, aggregator.MAX_READING()));
        r2 = uint32(bound(r2, 0, aggregator.MAX_READING()));
        r3 = uint32(bound(r3, 0, aggregator.MAX_READING()));
        uint256 expected = (50 * uint256(r1) + 30 * uint256(r2) + 20 * uint256(r3)) / 100;

        vm.prank(chirps);
        aggregator.submitReading(PERIOD, r1);
        aggregator.updateReputation(chirps, bound(w1, 1, 10_000));
        aggregator.updateReputation(nasaPower, bound(w2, 1, 10_000));
        aggregator.updateReputation(meteostat, bound(w3, 1, 10_000));
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, r2);
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, r3);
        aggregator.finalizePeriod(PERIOD);

        assertEq(aggregator.finalizedAggregate(PERIOD), expected);
    }

    /// @dev Invariant check: however the reputation weights are split, a
    ///      weighted average can never fall outside the range spanned by
    ///      the individual readings that went into it. This is exactly
    ///      the property that makes reputation weighting safe to swap in
    ///      for a single-source or equal-weight baseline: it can shift the
    ///      estimate toward the more reliable sources, but it can never
    ///      produce a number no source actually reported.
    function testFuzz_WeightedAverageStaysWithinReadingBounds(uint32 r1, uint32 r2, uint32 r3) public {
        r1 = uint32(bound(r1, 0, aggregator.MAX_READING()));
        r2 = uint32(bound(r2, 0, aggregator.MAX_READING()));
        r3 = uint32(bound(r3, 0, aggregator.MAX_READING()));

        vm.prank(chirps);
        aggregator.submitReading(PERIOD, r1);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, r2);
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, r3);

        aggregator.finalizePeriod(PERIOD);
        uint256 result = aggregator.finalizedAggregate(PERIOD);

        uint256 lo = _min3(r1, r2, r3);
        uint256 hi = _max3(r1, r2, r3);

        assertGe(result, lo);
        assertLe(result, hi);
    }

    function _reportAll(uint256 c, uint256 n, uint256 m) private {
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, c);
        vm.prank(nasaPower);
        aggregator.submitReading(PERIOD, n);
        vm.prank(meteostat);
        aggregator.submitReading(PERIOD, m);
    }

    function _min3(uint256 a, uint256 b, uint256 c) private pure returns (uint256) {
        uint256 m = a < b ? a : b;
        return m < c ? m : c;
    }

    function _max3(uint256 a, uint256 b, uint256 c) private pure returns (uint256) {
        uint256 m = a > b ? a : b;
        return m > c ? m : c;
    }
}
