// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {OracleAggregator} from "./OracleAggregator.sol";

/// @title WeatherIndexInsurance
/// @notice Weather-indexed micro-insurance for smallholder pearl millet
///         farmers in Sokoto State. A policy pays out automatically when
///         the reputation-weighted rainfall for its coverage window falls
///         below a drought threshold — no claims process, no loss
///         assessment, just oracle readings compared to a number.
/// @dev A coverage window is a list of dekad periods (ten-day blocks, ids
///      like 2026071 for 1-10 Jul 2026) published by the owner. Oracles
///      report each dekad once to the OracleAggregator; a policy settles on
///      the sum of its window's finalized dekad aggregates, so overlapping
///      windows (e.g. "July" and "June-July") share the same reports.
///
///      Every policy reserves its payout when it is sold, and a sale is
///      refused if the unreserved pool can't cover it, so a triggered
///      policy can always be paid.
///
///      This is a capstone prototype, not a production insurance system:
///      premiums are a flat rate of the payout with no actuarial pricing.
///      Its purpose is to demonstrate the payout mechanics and how directly
///      payout correctness depends on the oracle aggregation feeding it.
contract WeatherIndexInsurance {
    address public owner;
    /// @notice Proposed new owner; becomes owner only by calling acceptOwnership.
    address public pendingOwner;
    OracleAggregator public aggregator;

    /// @notice Upper bound on dekads per window (a full growing season is ~12).
    uint256 public constant MAX_WINDOW_PERIODS = 12;

    struct CoverageWindow {
        uint64 salesCloseAt; // policies can be bought until this timestamp
        uint256[] periods; // OracleAggregator period ids, strictly increasing
    }

    struct Policy {
        address farmer;
        uint256 windowId;
        uint256 droughtThresholdMm; // pays out if the window's summed rainfall (mm * 100) is below this
        uint256 payoutAmount; // wei
        uint256 premiumPaid; // wei; zero for owner-issued policies
        bool settled;
    }

    uint256 public nextWindowId;
    mapping(uint256 => CoverageWindow) private windows;

    uint256 public nextPolicyId;
    mapping(uint256 => Policy) public policies;

    /// @notice Premium as basis points of the payout (1000 = 10%).
    uint256 public premiumRateBps = 1000;
    /// @notice Sum of payouts owed by policies that haven't been settled yet.
    uint256 public reservedPayouts;

    event CoverageWindowAdded(uint256 indexed windowId, uint256[] periods, uint64 salesCloseAt);
    event PremiumRateUpdated(uint256 oldRateBps, uint256 newRateBps);
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed farmer,
        uint256 indexed windowId,
        uint256 droughtThresholdMm,
        uint256 payoutAmount,
        uint256 premiumPaid
    );
    event PayoutTriggered(uint256 indexed policyId, address indexed farmer, uint256 windowRainfallMm, uint256 payoutAmount);
    event PayoutSkipped(uint256 indexed policyId, uint256 windowRainfallMm, uint256 droughtThresholdMm);
    event PoolFunded(address indexed from, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "WeatherIndexInsurance: caller is not owner");
        _;
    }

    constructor(address aggregatorAddress) {
        owner = msg.sender;
        aggregator = OracleAggregator(aggregatorAddress);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Starts handing the contract to `newOwner` (e.g. a multisig).
    ///         Nothing changes until `newOwner` calls acceptOwnership, so a
    ///         mistyped address can't take control. Proposing address(0)
    ///         cancels a pending transfer.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Completes a transfer started by transferOwnership.
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "WeatherIndexInsurance: caller is not pending owner");
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    /// @notice Adds funds to the shared payout pool. Anyone can top it up.
    function fundPool() external payable {
        emit PoolFunded(msg.sender, msg.value);
    }

    /// @notice Publishes a coverage window farmers can buy policies for.
    /// @param periods The dekad periods the window covers, strictly increasing.
    /// @param salesCloseAt Timestamp after which no more policies can be sold,
    ///        normally before the first dekad starts so nobody can buy cover
    ///        for a drought that is already visible.
    function addCoverageWindow(uint256[] calldata periods, uint64 salesCloseAt)
        external
        onlyOwner
        returns (uint256 windowId)
    {
        require(periods.length > 0, "WeatherIndexInsurance: window has no periods");
        require(periods.length <= MAX_WINDOW_PERIODS, "WeatherIndexInsurance: window too long");
        require(salesCloseAt > block.timestamp, "WeatherIndexInsurance: sales close in the past");
        for (uint256 i = 1; i < periods.length; i++) {
            require(periods[i] > periods[i - 1], "WeatherIndexInsurance: periods must be strictly increasing");
        }

        windowId = nextWindowId++;
        CoverageWindow storage w = windows[windowId];
        w.salesCloseAt = salesCloseAt;
        w.periods = periods;

        emit CoverageWindowAdded(windowId, periods, salesCloseAt);
    }

    function getCoverageWindow(uint256 windowId)
        external
        view
        returns (uint64 salesCloseAt, uint256[] memory periods)
    {
        CoverageWindow storage w = windows[windowId];
        return (w.salesCloseAt, w.periods);
    }

    function setPremiumRate(uint256 newRateBps) external onlyOwner {
        require(newRateBps > 0 && newRateBps <= 10_000, "WeatherIndexInsurance: rate out of range");
        emit PremiumRateUpdated(premiumRateBps, newRateBps);
        premiumRateBps = newRateBps;
    }

    /// @notice Premium due for a given payout, rounded up so it is never zero.
    function quotePremium(uint256 payoutAmount) public view returns (uint256) {
        return (payoutAmount * premiumRateBps + 9_999) / 10_000;
    }

    /// @notice Pool balance not already reserved for unsettled policies.
    function availableCapacity() public view returns (uint256) {
        return address(this).balance - reservedPayouts;
    }

    /// @notice Buys a policy for the caller. Send exactly `quotePremium(payoutAmount)`.
    function buyPolicy(uint256 windowId, uint256 droughtThresholdMm, uint256 payoutAmount)
        external
        payable
        returns (uint256 policyId)
    {
        require(msg.value == quotePremium(payoutAmount), "WeatherIndexInsurance: wrong premium");
        // The premium is already in the balance, so it counts toward the reserve.
        return _issue(msg.sender, windowId, droughtThresholdMm, payoutAmount, msg.value);
    }

    /// @notice Issues a policy without a premium, e.g. subsidised cover.
    function createPolicy(address farmer, uint256 windowId, uint256 droughtThresholdMm, uint256 payoutAmount)
        external
        onlyOwner
        returns (uint256 policyId)
    {
        require(farmer != address(0), "WeatherIndexInsurance: farmer is zero address");
        return _issue(farmer, windowId, droughtThresholdMm, payoutAmount, 0);
    }

    function _issue(
        address farmer,
        uint256 windowId,
        uint256 droughtThresholdMm,
        uint256 payoutAmount,
        uint256 premiumPaid
    ) private returns (uint256 policyId) {
        CoverageWindow storage w = windows[windowId];
        require(w.periods.length > 0, "WeatherIndexInsurance: window does not exist");
        require(block.timestamp < w.salesCloseAt, "WeatherIndexInsurance: sales closed for window");
        require(droughtThresholdMm > 0, "WeatherIndexInsurance: threshold must be positive");
        require(payoutAmount > 0, "WeatherIndexInsurance: payout must be positive");
        require(availableCapacity() >= payoutAmount, "WeatherIndexInsurance: pool cannot cover payout");

        reservedPayouts += payoutAmount;
        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            farmer: farmer,
            windowId: windowId,
            droughtThresholdMm: droughtThresholdMm,
            payoutAmount: payoutAmount,
            premiumPaid: premiumPaid,
            settled: false
        });

        emit PolicyCreated(policyId, farmer, windowId, droughtThresholdMm, payoutAmount, premiumPaid);
    }

    /// @notice Anyone can call this once every dekad in the policy's window
    ///         has been finalized. Pays the farmer automatically if the
    ///         window's summed rainfall is below the policy's drought
    ///         threshold; otherwise it just records that no payout was due
    ///         and releases the reserve. Each policy can only be settled once.
    function checkAndSettle(uint256 policyId) external {
        Policy storage policy = policies[policyId];
        require(policy.farmer != address(0), "WeatherIndexInsurance: policy does not exist");
        require(!policy.settled, "WeatherIndexInsurance: already settled");

        uint256 windowRainfallMm = windowRainfall(policy.windowId);

        policy.settled = true;
        reservedPayouts -= policy.payoutAmount;

        if (windowRainfallMm < policy.droughtThresholdMm) {
            (bool sent, ) = policy.farmer.call{value: policy.payoutAmount}("");
            require(sent, "WeatherIndexInsurance: payout transfer failed");
            emit PayoutTriggered(policyId, policy.farmer, windowRainfallMm, policy.payoutAmount);
        } else {
            emit PayoutSkipped(policyId, windowRainfallMm, policy.droughtThresholdMm);
        }
    }

    /// @notice Summed rainfall (mm * 100) over a window; reverts until every
    ///         dekad in it has been finalized by the aggregator.
    function windowRainfall(uint256 windowId) public view returns (uint256 total) {
        uint256[] storage periods = windows[windowId].periods;
        require(periods.length > 0, "WeatherIndexInsurance: window does not exist");
        for (uint256 i = 0; i < periods.length; i++) {
            require(aggregator.isFinalized(periods[i]), "WeatherIndexInsurance: window not finalized yet");
            total += aggregator.finalizedAggregate(periods[i]);
        }
    }
}
