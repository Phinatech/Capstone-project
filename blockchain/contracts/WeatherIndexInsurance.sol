// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {OracleAggregator} from "./OracleAggregator.sol";

/// @title WeatherIndexInsurance
/// @notice Weather-indexed micro-insurance for smallholder pearl millet
///         farmers in Sokoto State. A policy pays out automatically when
///         the reputation-weighted rainfall aggregate for its coverage
///         period falls below a drought threshold — no claims process, no
///         loss assessment, just an oracle reading compared to a number.
/// @dev This is a capstone prototype, not a production insurance system:
///      premiums and payouts are held in a single shared pool rather than
///      per-policy escrow, and there is no actuarial pricing model. Its
///      purpose is to demonstrate the payout mechanics and, in particular,
///      how directly payout correctness depends on the quality of the
///      oracle aggregation feeding it — which is the object of study in
///      the capstone, not this contract itself.
contract WeatherIndexInsurance {
    address public owner;
    OracleAggregator public aggregator;

    struct Policy {
        address farmer;
        uint256 period; // the OracleAggregator reporting period this policy is tied to
        uint256 droughtThresholdMm; // pays out if the aggregate rainfall estimate is below this
        uint256 payoutAmount; // wei
        bool claimed;
    }

    uint256 public nextPolicyId;
    mapping(uint256 => Policy) public policies;

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed farmer,
        uint256 period,
        uint256 droughtThresholdMm,
        uint256 payoutAmount
    );
    event PayoutTriggered(uint256 indexed policyId, address indexed farmer, uint256 aggregateRainfallMm, uint256 payoutAmount);
    event PayoutSkipped(uint256 indexed policyId, uint256 aggregateRainfallMm, uint256 droughtThresholdMm);
    event PoolFunded(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "WeatherIndexInsurance: caller is not owner");
        _;
    }

    constructor(address aggregatorAddress) {
        owner = msg.sender;
        aggregator = OracleAggregator(aggregatorAddress);
    }

    /// @notice Adds funds to the shared payout pool. Anyone can top it up.
    function fundPool() external payable {
        emit PoolFunded(msg.sender, msg.value);
    }

    function createPolicy(
        address farmer,
        uint256 period,
        uint256 droughtThresholdMm,
        uint256 payoutAmount
    ) external onlyOwner returns (uint256 policyId) {
        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            farmer: farmer,
            period: period,
            droughtThresholdMm: droughtThresholdMm,
            payoutAmount: payoutAmount,
            claimed: false
        });

        emit PolicyCreated(policyId, farmer, period, droughtThresholdMm, payoutAmount);
    }

    /// @notice Anyone can call this once the aggregator has finalized the
    ///         policy's reporting period. Pays the farmer automatically if
    ///         the weighted rainfall estimate is below the policy's
    ///         drought threshold; otherwise it just records that no payout
    ///         was due. Each policy can only be settled once.
    function checkAndSettle(uint256 policyId) external {
        Policy storage policy = policies[policyId];
        require(policy.farmer != address(0), "WeatherIndexInsurance: policy does not exist");
        require(!policy.claimed, "WeatherIndexInsurance: already claimed");
        require(aggregator.isFinalized(policy.period), "WeatherIndexInsurance: period not finalized yet");

        uint256 aggregateRainfallMm = aggregator.finalizedAggregate(policy.period);
        policy.claimed = true;

        if (aggregateRainfallMm < policy.droughtThresholdMm) {
            require(address(this).balance >= policy.payoutAmount, "WeatherIndexInsurance: pool underfunded");
            (bool sent, ) = policy.farmer.call{value: policy.payoutAmount}("");
            require(sent, "WeatherIndexInsurance: payout transfer failed");
            emit PayoutTriggered(policyId, policy.farmer, aggregateRainfallMm, policy.payoutAmount);
        } else {
            emit PayoutSkipped(policyId, aggregateRainfallMm, policy.droughtThresholdMm);
        }
    }
}
