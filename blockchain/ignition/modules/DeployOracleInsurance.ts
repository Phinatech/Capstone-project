import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/// Deploys the OracleAggregator and wires a WeatherIndexInsurance contract
/// to read from it. Registering real oracle addresses, setting reputation
/// weights, and creating policies is left to a follow-up script or console
/// session, since those values depend on the deployment environment
/// (which addresses represent CHIRPS/NASA POWER/Meteostat, what the
/// off-chain reliability backtest produced, etc.).
export default buildModule("OracleInsuranceModule", (m) => {
  const aggregator = m.contract("OracleAggregator");
  const insurance = m.contract("WeatherIndexInsurance", [aggregator]);

  return { aggregator, insurance };
});
