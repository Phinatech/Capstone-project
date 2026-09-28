// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title OracleAggregator
/// @notice Combines rainfall readings from multiple independent weather data
///         sources (e.g. CHIRPS, NASA POWER, Meteostat) into a single
///         estimate for a reporting period, weighting each source by its
///         historical reliability rather than treating all sources equally
///         or relying on a single feed.
/// @dev Reputation weights are computed off-chain — for example by
///      backtesting each source against verified historical rainfall
///      records for the target region — and set here by the contract
///      owner. The contract's job is limited to collecting readings and
///      computing the weighted aggregate; it does not attempt reliability
///      analysis on-chain, since the ground-truth data needed for that
///      isn't available on-chain and would be prohibitively expensive to
///      verify in a smart contract even if it were.
///
///      This design is what makes the single-source and equally-weighted
///      baselines easy to compare against in the capstone's evaluation:
///      both are just this same aggregation formula with different weight
///      vectors (one non-zero weight, or all weights equal), so the
///      comparison is a difference in configuration, not implementation.
contract OracleAggregator {
    address public owner;

    struct Oracle {
        bool registered;
        string label; // e.g. "CHIRPS", "NASA_POWER", "Meteostat"
        uint256 reputationWeight; // relative weight; need not sum to any fixed total
    }

    struct Reading {
        bool submitted;
        uint256 rainfallMm; // rainfall in millimetres, scaled by 100 for 2dp precision
    }

    // period => oracle address => that oracle's reading for the period
    mapping(uint256 => mapping(address => Reading)) private readings;
    // period => addresses that have submitted a reading for it, in submission order
    mapping(uint256 => address[]) private submittersByPeriod;

    mapping(address => Oracle) public oracles;
    address[] public oracleList;

    mapping(uint256 => uint256) public finalizedAggregate; // period => weighted rainfall (mm * 100)
    mapping(uint256 => bool) public isFinalized;

    event OracleRegistered(address indexed oracle, string label, uint256 reputationWeight);
    event ReputationUpdated(address indexed oracle, uint256 oldWeight, uint256 newWeight);
    event ReadingSubmitted(address indexed oracle, uint256 indexed period, uint256 rainfallMm);
    event PeriodFinalized(uint256 indexed period, uint256 weightedRainfallMm, uint256 sourcesUsed);

    modifier onlyOwner() {
        require(msg.sender == owner, "OracleAggregator: caller is not owner");
        _;
    }

    modifier onlyRegisteredOracle() {
        require(oracles[msg.sender].registered, "OracleAggregator: not a registered oracle");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Registers a new oracle source with its initial reputation weight.
    /// @param oracleAddress The address this source will submit readings from.
    /// @param label A human-readable name for the source, e.g. "CHIRPS".
    /// @param reputationWeight The source's initial weight, informed by
    ///        off-chain historical reliability analysis.
    function registerOracle(
        address oracleAddress,
        string calldata label,
        uint256 reputationWeight
    ) external onlyOwner {
        require(!oracles[oracleAddress].registered, "OracleAggregator: already registered");
        require(reputationWeight > 0, "OracleAggregator: weight must be positive");

        oracles[oracleAddress] = Oracle({
            registered: true,
            label: label,
            reputationWeight: reputationWeight
        });
        oracleList.push(oracleAddress);

        emit OracleRegistered(oracleAddress, label, reputationWeight);
    }

    /// @notice Updates a previously registered oracle's reputation weight,
    ///         e.g. after re-running the off-chain reliability backtest with
    ///         a new season of data.
    function updateReputation(address oracleAddress, uint256 newWeight) external onlyOwner {
        require(oracles[oracleAddress].registered, "OracleAggregator: not registered");
        require(newWeight > 0, "OracleAggregator: weight must be positive");

        uint256 oldWeight = oracles[oracleAddress].reputationWeight;
        oracles[oracleAddress].reputationWeight = newWeight;

        emit ReputationUpdated(oracleAddress, oldWeight, newWeight);
    }

    /// @notice Called by a registered oracle to submit its rainfall reading
    ///         for a given reporting period (e.g. a dekad of the growing season).
    function submitReading(uint256 period, uint256 rainfallMm) external onlyRegisteredOracle {
        require(!isFinalized[period], "OracleAggregator: period already finalized");
        require(!readings[period][msg.sender].submitted, "OracleAggregator: already submitted for period");

        readings[period][msg.sender] = Reading({submitted: true, rainfallMm: rainfallMm});
        submittersByPeriod[period].push(msg.sender);

        emit ReadingSubmitted(msg.sender, period, rainfallMm);
    }

    /// @notice Computes the reputation-weighted rainfall estimate for a
    ///         period from whichever registered oracles have reported so
    ///         far, and locks it in permanently. Callable by anyone once at
    ///         least one reading exists, so an insurance contract (or
    ///         anyone) can trigger finalization once the reporting window
    ///         has closed off-chain.
    /// @dev Weights are normalized implicitly by dividing the weighted sum
    ///      by the total weight of sources that actually reported, so a
    ///      missing source doesn't skew the result toward zero.
    function finalizePeriod(uint256 period) external returns (uint256 weightedRainfallMm) {
        require(!isFinalized[period], "OracleAggregator: already finalized");

        address[] memory submitters = submittersByPeriod[period];
        require(submitters.length > 0, "OracleAggregator: no readings submitted");

        uint256 weightedSum = 0;
        uint256 weightTotal = 0;

        for (uint256 i = 0; i < submitters.length; i++) {
            address oracleAddr = submitters[i];
            uint256 weight = oracles[oracleAddr].reputationWeight;
            weightedSum += weight * readings[period][oracleAddr].rainfallMm;
            weightTotal += weight;
        }

        weightedRainfallMm = weightedSum / weightTotal;

        finalizedAggregate[period] = weightedRainfallMm;
        isFinalized[period] = true;

        emit PeriodFinalized(period, weightedRainfallMm, submitters.length);
    }

    function getOracleCount() external view returns (uint256) {
        return oracleList.length;
    }
}
