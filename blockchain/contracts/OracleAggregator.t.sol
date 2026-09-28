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
        // meteostat does not report this period

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
        vm.prank(chirps);
        aggregator.submitReading(PERIOD, 1000);
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

    /// @dev Invariant check: however the reputation weights are split, a
    ///      weighted average can never fall outside the range spanned by
    ///      the individual readings that went into it. This is exactly
    ///      the property that makes reputation weighting safe to swap in
    ///      for a single-source or equal-weight baseline: it can shift the
    ///      estimate toward the more reliable sources, but it can never
    ///      produce a number no source actually reported.
    function testFuzz_WeightedAverageStaysWithinReadingBounds(uint32 r1, uint32 r2, uint32 r3) public {
        r1 = uint32(bound(r1, 0, 50_000));
        r2 = uint32(bound(r2, 0, 50_000));
        r3 = uint32(bound(r3, 0, 50_000));

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

    function _min3(uint256 a, uint256 b, uint256 c) private pure returns (uint256) {
        uint256 m = a < b ? a : b;
        return m < c ? m : c;
    }

    function _max3(uint256 a, uint256 b, uint256 c) private pure returns (uint256) {
        uint256 m = a > b ? a : b;
        return m > c ? m : c;
    }
}
