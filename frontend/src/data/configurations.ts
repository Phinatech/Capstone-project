import type { ConfigurationProfile } from '../types/insurance';

// Gas and latency are modelled Sepolia estimates for the relayer's submitReading calls plus finalizePeriod.
// Aggregation runs on-chain in OracleAggregator, so cost grows with the number of sources that report.
export const configurationProfiles: ConfigurationProfile[] = [
{
  mode: 'single',
  name: 'Single source',
  shortName: 'Single',
  description: 'Trusts CHIRPS alone, mirroring existing single-feed deployments.',
  requestGas: 96_400,
  fulfillGas: 118_200,
  latencySec: 18.4
},
{
  mode: 'equal',
  name: 'Equally weighted',
  shortName: 'Equal',
  description: 'Averages all three sources with no adjustment for reliability.',
  requestGas: 104_900,
  fulfillGas: 118_600,
  latencySec: 19.1
},
{
  mode: 'reputation',
  name: 'Reputation weighted',
  shortName: 'Reputation',
  description: 'Weights each source by historical reliability and agreement with its peers.',
  requestGas: 109_300,
  fulfillGas: 121_800,
  latencySec: 19.7
}];