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
    /// @notice Proposed new owner; becomes owner only by calling acceptOwnership.
    address public pendingOwner;

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
    // Every source ever registered, in order; deactivated ones stay listed.
    address[] public oracleList;
    /// @notice Sources currently allowed to report.
    uint256 public activeOracleCount;
    /// @notice When a source was deactivated (0 if it never was). Its label
    ///         and weight stay readable through `oracles` as history.
    mapping(address => uint256) public deactivatedAt;

    mapping(uint256 => uint256) public finalizedAggregate; // period => weighted rainfall (mm * 100)
    mapping(uint256 => bool) public isFinalized;
    // period => timestamp of its first reading, which opens its reporting window
    mapping(uint256 => uint256) public firstReadingAt;
    // period => oracle => its weight when the period's first reading arrived.
    // Aggregation uses only these, so a later updateReputation (or a newly
    // registered source) can't change the outcome of a period already reporting.
    mapping(uint256 => mapping(address => uint256)) private periodWeight;
    // period => how many sources were active when its snapshot was taken
    mapping(uint256 => uint256) public periodOracleCount;

    /// @notice Fewest sources that must report before a period can be finalized.
    uint256 public minQuorum = 2;
    /// @notice How long after a period's first reading the other sources have
    ///         to report, unless every registered source reports sooner.
    uint256 public reportingWindow = 1 days;
    uint256 public constant MAX_REPORTING_WINDOW = 30 days;
    /// @notice Largest accepted reading: 500.00 mm (scaled by 100) in one
    ///         period, well above any dekad on record for the region, so a
    ///         garbage or mis-scaled value is rejected instead of aggregated.
    uint256 public constant MAX_READING = 50_000;

    event OracleRegistered(address indexed oracle, string label, uint256 reputationWeight);
    event ReputationUpdated(address indexed oracle, uint256 oldWeight, uint256 newWeight);
    event OracleDeactivated(address indexed oracle, string label, uint256 lastWeight);
    event ReadingSubmitted(address indexed oracle, uint256 indexed period, uint256 rainfallMm);
    event PeriodFinalized(uint256 indexed period, uint256 weightedRainfallMm, uint256 sourcesUsed);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event ReportingWindowUpdated(uint256 oldWindow, uint256 newWindow);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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
        require(msg.sender == pendingOwner, "OracleAggregator: caller is not pending owner");
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
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
        // Re-registering would overwrite the deactivated source's history.
        require(deactivatedAt[oracleAddress] == 0, "OracleAggregator: oracle was deactivated");
        require(reputationWeight > 0, "OracleAggregator: weight must be positive");

        oracles[oracleAddress] = Oracle({
            registered: true,
            label: label,
            reputationWeight: reputationWeight
        });
        oracleList.push(oracleAddress);
        activeOracleCount++;

        emit OracleRegistered(oracleAddress, label, reputationWeight);
    }

    /// @notice Permanently stops a source from reporting, e.g. after its key
    ///         leaks or the feed is retired. Its label and last weight are
    ///         kept as history, and it is left out of periods that haven't
    ///         started yet. Readings it already submitted for periods still
    ///         reporting keep counting: like reweighting (M-2), deactivation
    ///         can't change the outcome of a period already under way.
    ///         If this leaves fewer active sources than `minQuorum`, lower
    ///         the quorum so new periods can still finalize.
    function deactivateOracle(address oracleAddress) external onlyOwner {
        Oracle storage o = oracles[oracleAddress];
        require(o.registered, "OracleAggregator: not registered");

        o.registered = false;
        deactivatedAt[oracleAddress] = block.timestamp;
        activeOracleCount--;

        emit OracleDeactivated(oracleAddress, o.label, o.reputationWeight);
    }

    /// @notice Updates a previously registered oracle's reputation weight,
    ///         e.g. after re-running the off-chain reliability backtest with
    ///         a new season of data. Takes effect from the next period to
    ///         receive its first reading; periods already reporting keep the
    ///         weights they started with.
    function updateReputation(address oracleAddress, uint256 newWeight) external onlyOwner {
        require(oracles[oracleAddress].registered, "OracleAggregator: not registered");
        require(newWeight > 0, "OracleAggregator: weight must be positive");

        uint256 oldWeight = oracles[oracleAddress].reputationWeight;
        oracles[oracleAddress].reputationWeight = newWeight;

        emit ReputationUpdated(oracleAddress, oldWeight, newWeight);
    }

    /// @notice Sets how many sources must report before a period can be
    ///         finalized. Lowering it is the recovery path if sources go
    ///         offline for good; it can't exceed the number of sources.
    function setMinQuorum(uint256 newQuorum) external onlyOwner {
        require(newQuorum > 0, "OracleAggregator: quorum must be positive");
        require(newQuorum <= activeOracleCount, "OracleAggregator: quorum exceeds active oracles");
        emit QuorumUpdated(minQuorum, newQuorum);
        minQuorum = newQuorum;
    }

    function setReportingWindow(uint256 newWindow) external onlyOwner {
        require(newWindow <= MAX_REPORTING_WINDOW, "OracleAggregator: window too long");
        emit ReportingWindowUpdated(reportingWindow, newWindow);
        reportingWindow = newWindow;
    }

    /// @notice Called by a registered oracle to submit its rainfall reading
    ///         for a given reporting period (e.g. a dekad of the growing season).
    ///         The period's first reading snapshots every source's weight.
    function submitReading(uint256 period, uint256 rainfallMm) external onlyRegisteredOracle {
        require(!isFinalized[period], "OracleAggregator: period already finalized");
        require(!readings[period][msg.sender].submitted, "OracleAggregator: already submitted for period");
        require(rainfallMm <= MAX_READING, "OracleAggregator: reading out of range");

        if (submittersByPeriod[period].length == 0) {
            firstReadingAt[period] = block.timestamp;
            _snapshotWeights(period);
        }
        require(periodWeight[period][msg.sender] > 0, "OracleAggregator: registered after period opened");

        readings[period][msg.sender] = Reading({submitted: true, rainfallMm: rainfallMm});
        submittersByPeriod[period].push(msg.sender);

        emit ReadingSubmitted(msg.sender, period, rainfallMm);
    }

    /// @notice Computes the reputation-weighted rainfall estimate for a
    ///         period from whichever registered oracles have reported, and
    ///         locks it in permanently. Callable by anyone once at least
    ///         `minQuorum` sources have reported and either every registered
    ///         source has reported or `reportingWindow` has passed since the
    ///         period's first reading. That stops one early (possibly
    ///         malicious) reading from being finalized before honest sources
    ///         have had a chance to report.
    /// @dev Weights are normalized implicitly by dividing the weighted sum
    ///      by the total weight of sources that actually reported, so a
    ///      missing source doesn't skew the result toward zero.
    function finalizePeriod(uint256 period) external returns (uint256 weightedRainfallMm) {
        require(!isFinalized[period], "OracleAggregator: already finalized");

        address[] memory submitters = submittersByPeriod[period];
        require(submitters.length > 0, "OracleAggregator: no readings submitted");
        require(submitters.length >= minQuorum, "OracleAggregator: quorum not reached");
        require(
            submitters.length == periodOracleCount[period] || block.timestamp >= firstReadingAt[period] + reportingWindow,
            "OracleAggregator: reporting window still open"
        );

        uint256 weightedSum = 0;
        uint256 weightTotal = 0;

        for (uint256 i = 0; i < submitters.length; i++) {
            address oracleAddr = submitters[i];
            uint256 weight = periodWeight[period][oracleAddr];
            weightedSum += weight * readings[period][oracleAddr].rainfallMm;
            weightTotal += weight;
        }

        weightedRainfallMm = weightedSum / weightTotal;

        finalizedAggregate[period] = weightedRainfallMm;
        isFinalized[period] = true;

        emit PeriodFinalized(period, weightedRainfallMm, submitters.length);
    }

    /// @notice The weight a source carries in a period: its weight when the
    ///         period's first reading arrived, or 0 before that (or if it was
    ///         registered afterwards).
    function weightForPeriod(uint256 period, address oracleAddress) external view returns (uint256) {
        return periodWeight[period][oracleAddress];
    }

    function _snapshotWeights(uint256 period) private {
        uint256 active = 0;
        for (uint256 i = 0; i < oracleList.length; i++) {
            address o = oracleList[i];
            if (!oracles[o].registered) continue; // deactivated: no weight in new periods
            periodWeight[period][o] = oracles[o].reputationWeight;
            active++;
        }
        periodOracleCount[period] = active;
    }

    function getOracleCount() external view returns (uint256) {
        return oracleList.length;
    }
}
