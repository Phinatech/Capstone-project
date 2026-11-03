import type { TranslationKey } from './translations';

/** Title and body are translation keys; render them with t(). */
export interface OnboardingStep {
  title: TranslationKey;
  body: TranslationKey;
  icon: 'shield' | 'radio' | 'wallet' | 'scale' | 'flask' | 'bell';
}

const step = (role: 'farmer' | 'admin' | 'agent', n: number, icon: OnboardingStep['icon']): OnboardingStep => ({
  icon,
  title: `tour.${role}.${n}.title` as TranslationKey,
  body: `tour.${role}.${n}.body` as TranslationKey
});

export const onboardingSteps: Record<'farmer' | 'admin' | 'agent', OnboardingStep[]> = {
  farmer: [step('farmer', 1, 'shield'), step('farmer', 2, 'radio'), step('farmer', 3, 'wallet')],
  admin: [step('admin', 1, 'scale'), step('admin', 2, 'flask'), step('admin', 3, 'bell')],
  agent: [step('agent', 1, 'shield'), step('agent', 2, 'wallet'), step('agent', 3, 'bell')]
};

export const RELEASE_VERSION = '2.1.0';

/** Translation keys; render them with t(). */
export const releaseNotes: {title: TranslationKey;body: TranslationKey;}[] = [1, 2, 3, 4, 5].map((n) => ({
  title: `release.${n}.title` as TranslationKey,
  body: `release.${n}.body` as TranslationKey
}));
