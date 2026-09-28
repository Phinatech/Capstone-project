import type { CoverageWindow, Policy } from '../types/insurance';

export const startingBalanceEth = 0.25;

export const contractPoolStartEth = 1.2;

export const lgas = ['Wamakko', 'Kware', 'Bodinga', 'Tambuwal', 'Gwadabawa', 'Illela', 'Goronyo', 'Rabah'];

export const crops = ['Millet', 'Sorghum'];

export const payoutOptionsEth = [0.01, 0.02, 0.05];

export const premiumRate = 0.1;

export const coverageWindows: CoverageWindow[] = [
{ id: 'jun', label: 'June establishment', start: 0, end: 2 },
{ id: 'jul', label: 'July critical growth', start: 3, end: 5 },
{ id: 'junjul', label: 'June – July', start: 0, end: 5 },
{ id: 'julaug', label: 'July – August', start: 3, end: 8 },
{ id: 'augsep', label: 'August – September', start: 6, end: 11 }];


export const seedPolicies: Policy[] = [
{
  id: 1,
  farmerId: 'farmer-1',
  lga: 'Wamakko',
  crop: 'Millet',
  windowId: 'jul',
  thresholdMm: 88,
  premiumEth: 0.002,
  payoutEth: 0.02,
  purchasedAt: '2023-06-12',
  status: 'active'
},
{
  id: 2,
  farmerId: 'farmer-2',
  lga: 'Kware',
  crop: 'Sorghum',
  windowId: 'julaug',
  thresholdMm: 265,
  premiumEth: 0.005,
  payoutEth: 0.05,
  purchasedAt: '2023-06-20',
  status: 'active'
},
{
  id: 3,
  farmerId: 'farmer-1',
  lga: 'Wamakko',
  crop: 'Sorghum',
  windowId: 'jun',
  thresholdMm: 64,
  premiumEth: 0.001,
  payoutEth: 0.01,
  purchasedAt: '2023-06-01',
  status: 'active'
},
{
  id: 4,
  farmerId: 'farmer-3',
  lga: 'Bodinga',
  crop: 'Millet',
  windowId: 'junjul',
  thresholdMm: 150,
  premiumEth: 0.002,
  payoutEth: 0.02,
  purchasedAt: '2023-05-30',
  status: 'active'
},
{
  id: 5,
  farmerId: 'farmer-4',
  lga: 'Tambuwal',
  crop: 'Millet',
  windowId: 'augsep',
  thresholdMm: 250,
  premiumEth: 0.005,
  payoutEth: 0.05,
  purchasedAt: '2023-07-15',
  status: 'active'
},
{
  id: 6,
  farmerId: 'farmer-2',
  lga: 'Kware',
  crop: 'Millet',
  windowId: 'jul',
  thresholdMm: 80,
  premiumEth: 0.001,
  payoutEth: 0.01,
  purchasedAt: '2023-06-22',
  status: 'active'
}];


// Policies already settled by the reputation-weighted oracle before the demo starts.
export const seedSettlements: {policyId: number;evaluatedAt: string;}[] = [
{ policyId: 3, evaluatedAt: '2023-07-02T09:14:00Z' },
{ policyId: 5, evaluatedAt: '2023-10-01T08:40:00Z' }];