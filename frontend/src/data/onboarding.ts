export interface OnboardingStep {
  title: string;
  body: string;
  icon: 'shield' | 'radio' | 'wallet' | 'scale' | 'flask' | 'bell';
}

export const onboardingSteps: Record<'farmer' | 'admin' | 'agent', OnboardingStep[]> = {
  farmer: [
  {
    icon: 'shield',
    title: 'Cover that pays without a claim',
    body: 'Choose a coverage window and the rainfall level that would hurt your harvest. If the rain falls short, you are paid automatically.'
  },
  {
    icon: 'radio',
    title: 'Three sources, one fair decision',
    body: 'CHIRPS, NASA POWER and Meteostat are compared. A source that disagrees sharply with the others loses influence, so one bad reading cannot decide your payout.'
  },
  {
    icon: 'wallet',
    title: 'Straight to your wallet',
    body: 'Payouts land in your Sepolia wallet. Track every policy, payout and alert from your dashboard and notifications.'
  }],

  admin: [
  {
    icon: 'scale',
    title: 'Settle the evaluation queue',
    body: 'Policies whose coverage window has closed appear on the overview. Open one to request an oracle round and settle it on-chain.'
  },
  {
    icon: 'flask',
    title: 'Stress-test the oracle',
    body: 'Corrupt a source during evaluation or open the backtest to compare single-source, equal and reputation-weighted decisions.'
  },
  {
    icon: 'bell',
    title: 'Stay on top of live events',
    body: 'Feed updates, premiums and settlements arrive as real-time notifications. Use search (Ctrl K) to jump anywhere.'
  }],

  agent: [
  {
    icon: 'shield',
    title: 'Insure farmers from your wallet',
    body: 'Select a farmer, set the rainfall threshold, and pay the premium from your agent wallet. The farmer is paid automatically if the season falls short.'
  },
  {
    icon: 'wallet',
    title: 'No crypto knowledge needed',
    body: 'The farmer does not need a wallet or any blockchain knowledge. You handle the transaction; they receive the payout directly.'
  },
  {
    icon: 'bell',
    title: 'Track every policy',
    body: 'Monitor all farmer policies you have purchased, their status, and payouts from your agent dashboard.'
  }]

};

export const RELEASE_VERSION = '2.1.0';

export const releaseNotes: {title: string;body: string;}[] = [
{ title: 'Real-time notifications', body: 'A notification centre with live oracle and settlement events, plus a bell in the navbar.' },
{ title: 'List and card views', body: 'Switch between dense lists and cards on policies, farmers and payouts, with filters that fit on any screen.' },
{ title: 'Quick search', body: 'Press Ctrl K or use the sidebar search to jump to any page, policy or farmer.' },
{ title: 'New colour system', body: 'A calmer petrol accent with indigo, plum and graphite alternatives in light and dark mode.' },
{ title: 'Account security', body: 'Reset forgotten passwords, verify your email and change your password from Settings.' }];