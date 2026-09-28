// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {OracleAggregator} from "./OracleAggregator.sol";
import {WeatherIndexInsurance} from "./WeatherIndexInsurance.sol";

contract WeatherIndexInsuranceTest is Test {
    OracleAggregator aggregator;
    WeatherIndexInsurance insurance;

    address chirps = address(0x1001);
    address nasaPower = address(0x1002);
    address meteostat = address(0x1003);
    address farmer = address(0x2001);
    address stranger = address(0x2002);

    // July 2026: dekads 1-10, 11-20 and 21-31 Jul.
    uint256 constant JUL_D1 = 2026071;
    uint256 constant JUL_D2 = 2026072;
    uint256 constant JUL_D3 = 2026073;

    uint256 constant THRESHOLD = 10_000; // 100.00 mm over the window
    uint256 constant PAYOUT = 0.02 ether;
    uint256 constant PREMIUM = 0.002 ether; // 10% of PAYOUT

    uint256 julyWindow;

    function setUp() public {
        aggregator = new OracleAggregator();
        aggregator.registerOracle(chirps, "CHIRPS", 50);
        aggregator.registerOracle(nasaPower, "NASA_POWER", 30);
        aggregator.registerOracle(meteostat, "Meteostat", 20);

        insurance = new WeatherIndexInsurance(address(aggregator));
        vm.deal(address(this), 10 ether);
        insurance.fundPool{value: 1 ether}();

        julyWindow = insurance.addCoverageWindow(_periods3(JUL_D1, JUL_D2, JUL_D3), uint64(block.timestamp + 1 days));
        vm.deal(farmer, 1 ether);
    }

    // ---------- Buying ----------

    function test_FarmerBuysPolicyAndReservesPayout() public {
        uint256 id = _buy(farmer, PAYOUT);

        (address holder, uint256 windowId, uint256 threshold, uint256 payout, uint256 premium, bool settled) =
            insurance.policies(id);
        assertEq(holder, farmer);
        assertEq(windowId, julyWindow);
        assertEq(threshold, THRESHOLD);
        assertEq(payout, PAYOUT);
        assertEq(premium, PREMIUM);
        assertFalse(settled);
        assertEq(insurance.reservedPayouts(), PAYOUT);
        assertEq(address(insurance).balance, 1 ether + PREMIUM);
    }

    function test_RevertsOnWrongPremium() public {
        vm.prank(farmer);
        vm.expectRevert(bytes("WeatherIndexInsurance: wrong premium"));
        insurance.buyPolicy{value: PREMIUM - 1}(julyWindow, THRESHOLD, PAYOUT);
    }

    function test_PremiumRoundsUpSoItIsNeverZero() public view {
        assertEq(insurance.quotePremium(1), 1);
        assertEq(insurance.quotePremium(PAYOUT), PREMIUM);
    }

    function test_RevertsAfterSalesClose() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(farmer);
        vm.expectRevert(bytes("WeatherIndexInsurance: sales closed for window"));
        insurance.buyPolicy{value: PREMIUM}(julyWindow, THRESHOLD, PAYOUT);
    }

    function test_RevertsForUnknownWindow() public {
        vm.prank(farmer);
        vm.expectRevert(bytes("WeatherIndexInsurance: window does not exist"));
        insurance.buyPolicy{value: PREMIUM}(99, THRESHOLD, PAYOUT);
    }

    function test_RefusesSaleThePoolCannotCover() public {
        // Pool: 1 ether. The premium joins the pool, so the largest coverable
        // payout p satisfies 1 ether + premium(p) >= p.
        uint256 tooBig = 1.2 ether;
        uint256 premium = insurance.quotePremium(tooBig);
        vm.deal(farmer, premium);
        vm.prank(farmer);
        vm.expectRevert(bytes("WeatherIndexInsurance: pool cannot cover payout"));
        insurance.buyPolicy{value: premium}(julyWindow, THRESHOLD, tooBig);
    }

    function test_ReservedPayoutsLimitLaterSales() public {
        insurance.createPolicy(farmer, julyWindow, THRESHOLD, 1 ether);
        assertEq(insurance.availableCapacity(), 0);

        vm.prank(farmer);
        vm.expectRevert(bytes("WeatherIndexInsurance: pool cannot cover payout"));
        insurance.buyPolicy{value: PREMIUM}(julyWindow, THRESHOLD, PAYOUT);
    }

    // ---------- Windows and admin ----------

    function test_WindowValidation() public {
        uint64 later = uint64(block.timestamp + 1 days);

        vm.expectRevert(bytes("WeatherIndexInsurance: window has no periods"));
        insurance.addCoverageWindow(new uint256[](0), later);

        vm.expectRevert(bytes("WeatherIndexInsurance: window too long"));
        insurance.addCoverageWindow(new uint256[](13), later);

        vm.expectRevert(bytes("WeatherIndexInsurance: periods must be strictly increasing"));
        insurance.addCoverageWindow(_periods3(JUL_D1, JUL_D1, JUL_D2), later);

        vm.expectRevert(bytes("WeatherIndexInsurance: sales close in the past"));
        insurance.addCoverageWindow(_periods3(JUL_D1, JUL_D2, JUL_D3), uint64(block.timestamp));
    }

    function test_OnlyOwnerCanAddWindowsIssuePoliciesAndSetRate() public {
        vm.startPrank(stranger);
        vm.expectRevert(bytes("WeatherIndexInsurance: caller is not owner"));
        insurance.addCoverageWindow(_periods3(JUL_D1, JUL_D2, JUL_D3), uint64(block.timestamp + 1 days));
        vm.expectRevert(bytes("WeatherIndexInsurance: caller is not owner"));
        insurance.createPolicy(stranger, julyWindow, THRESHOLD, PAYOUT);
        vm.expectRevert(bytes("WeatherIndexInsurance: caller is not owner"));
        insurance.setPremiumRate(1);
        vm.stopPrank();
    }

    function test_PremiumRateChangesQuote() public {
        insurance.setPremiumRate(500); // 5%
        assertEq(insurance.quotePremium(PAYOUT), 0.001 ether);

        vm.expectRevert(bytes("WeatherIndexInsurance: rate out of range"));
        insurance.setPremiumRate(10_001);
    }

    // ---------- Settlement ----------

    function test_PaysOutWhenWindowRainfallIsBelowThreshold() public {
        uint256 id = _buy(farmer, PAYOUT);
        _report(JUL_D1, 3000, 3000, 3000);
        _report(JUL_D2, 3000, 3000, 3000);
        _report(JUL_D3, 3000, 3000, 3000); // window total 9000 < 10000

        uint256 before = farmer.balance;
        insurance.checkAndSettle(id);

        assertEq(farmer.balance, before + PAYOUT);
        assertEq(insurance.reservedPayouts(), 0);
    }

    function test_NoPayoutWhenWindowRainfallMeetsThreshold() public {
        uint256 id = _buy(farmer, PAYOUT);
        _report(JUL_D1, 4000, 4000, 4000);
        _report(JUL_D2, 3000, 3000, 3000);
        _report(JUL_D3, 3000, 3000, 3000); // window total 10000, not below 10000

        uint256 before = farmer.balance;
        insurance.checkAndSettle(id);

        assertEq(farmer.balance, before);
        assertEq(insurance.reservedPayouts(), 0);
        assertEq(insurance.availableCapacity(), 1 ether + PREMIUM);
    }

    function test_WindowRainfallSumsReputationWeightedDekads() public {
        _report(JUL_D1, 1000, 1400, 1800); // (50*1000 + 30*1400 + 20*1800) / 100 = 1280
        _report(JUL_D2, 2000, 2000, 2000); // 2000
        _report(JUL_D3, 500, 500, 500); // 500
        assertEq(insurance.windowRainfall(julyWindow), 3780);
    }

    function test_CannotSettleUntilEveryDekadIsFinalized() public {
        uint256 id = _buy(farmer, PAYOUT);
        _report(JUL_D1, 3000, 3000, 3000);
        _report(JUL_D2, 3000, 3000, 3000);

        vm.expectRevert(bytes("WeatherIndexInsurance: window not finalized yet"));
        insurance.checkAndSettle(id);
    }

    function test_CannotSettleTwice() public {
        uint256 id = _buy(farmer, PAYOUT);
        _report(JUL_D1, 3000, 3000, 3000);
        _report(JUL_D2, 3000, 3000, 3000);
        _report(JUL_D3, 3000, 3000, 3000);
        insurance.checkAndSettle(id);

        vm.expectRevert(bytes("WeatherIndexInsurance: already settled"));
        insurance.checkAndSettle(id);
    }

    function test_OverlappingWindowsShareDekadReports() public {
        uint256 lateJulyWindow = insurance.addCoverageWindow(_periods2(JUL_D2, JUL_D3), uint64(block.timestamp + 1 days));
        uint256 full = _buy(farmer, PAYOUT);
        vm.prank(farmer);
        uint256 late = insurance.buyPolicy{value: PREMIUM}(lateJulyWindow, 5_000, PAYOUT);

        _report(JUL_D1, 6000, 6000, 6000);
        _report(JUL_D2, 2000, 2000, 2000);
        _report(JUL_D3, 2000, 2000, 2000);

        // Same three reports: the full window got 10000 (no payout), the
        // late-July window got 4000 (< 5000, pays out).
        uint256 before = farmer.balance;
        insurance.checkAndSettle(full);
        insurance.checkAndSettle(late);
        assertEq(farmer.balance, before + PAYOUT);
    }

    /// @dev Invariant: whatever mix of policies is sold and settled, the
    ///      pool always holds at least what it owes unsettled policies.
    function testFuzz_ReservesNeverExceedPoolBalance(uint96[4] memory payouts, bool dry) public {
        uint256[] memory ids = new uint256[](4);
        uint256 sold;
        for (uint256 i = 0; i < 4; i++) {
            uint256 payout = bound(payouts[i], 1, 2 ether);
            uint256 premium = insurance.quotePremium(payout);
            vm.deal(farmer, premium);
            bool coverable = insurance.availableCapacity() + premium >= payout;
            vm.prank(farmer);
            if (coverable) {
                ids[sold++] = insurance.buyPolicy{value: premium}(julyWindow, THRESHOLD, payout);
            } else {
                vm.expectRevert(bytes("WeatherIndexInsurance: pool cannot cover payout"));
                insurance.buyPolicy{value: premium}(julyWindow, THRESHOLD, payout);
            }
            assertGe(address(insurance).balance, insurance.reservedPayouts());
        }

        uint256 perDekad = dry ? 1000 : 5000;
        _report(JUL_D1, perDekad, perDekad, perDekad);
        _report(JUL_D2, perDekad, perDekad, perDekad);
        _report(JUL_D3, perDekad, perDekad, perDekad);
        for (uint256 i = 0; i < sold; i++) {
            insurance.checkAndSettle(ids[i]);
            assertGe(address(insurance).balance, insurance.reservedPayouts());
        }
        assertEq(insurance.reservedPayouts(), 0);
    }

    // ---------- Helpers ----------

    function _buy(address who, uint256 payout) private returns (uint256) {
        uint256 premium = insurance.quotePremium(payout); // before prank: it applies to the next call only
        vm.prank(who);
        return insurance.buyPolicy{value: premium}(julyWindow, THRESHOLD, payout);
    }

    function _report(uint256 period, uint256 a, uint256 b, uint256 c) private {
        vm.prank(chirps);
        aggregator.submitReading(period, a);
        vm.prank(nasaPower);
        aggregator.submitReading(period, b);
        vm.prank(meteostat);
        aggregator.submitReading(period, c);
        aggregator.finalizePeriod(period);
    }

    function _periods2(uint256 a, uint256 b) private pure returns (uint256[] memory p) {
        p = new uint256[](2);
        (p[0], p[1]) = (a, b);
    }

    function _periods3(uint256 a, uint256 b, uint256 c) private pure returns (uint256[] memory p) {
        p = new uint256[](3);
        (p[0], p[1], p[2]) = (a, b, c);
    }
}
