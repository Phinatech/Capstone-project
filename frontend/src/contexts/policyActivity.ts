import type { TranslationKey } from '../data/translations';
import type { Policy } from '../types/insurance';
import type { AppNotification } from '../types/notification';
import type { User } from '../types/user';
import { formatEth, formatMm } from '../utils/format';
import { findUser } from '../utils/users';

type Translate = (key: TranslationKey | string, vars?: Record<string, string | number>) => string;

/** A crop's name in the reader's language, or as stored when there is no translation. */
export function cropName(crop: string, t: Translate): string {
  const key = `crop.${crop}`;
  const text = t(key);
  return text === key ? crop : text;
}

/**
 * The notifications one viewer should see, derived from the policies every
 * portal already reads from the chain: a farmer hears about their own
 * policies, an agent about the ones they sold, the administrator about all.
 *
 * They used to be written into the browser where something happened, so the
 * admin never heard of a farmer's purchase, the farmer never heard of an
 * agent's sale for them, and a payout the keeper settled unattended told no
 * one. Built from shared data instead, every portal sees the same events on
 * any device, worded for its reader and in their language.
 */
export function policyActivity(policies: Policy[], viewer: User, t: Translate): AppNotification[] {
  const audience = viewer.role === 'admin' ? 'admin' : viewer.role === 'agent' ? 'agent' : 'farmer';
  const mine = policies.filter((p) =>
    audience === 'admin' ? true : audience === 'agent' ? p.agentId === viewer.id : p.farmerId === viewer.id
  );
  const out: AppNotification[] = [];
  for (const p of mine) {
    const vars = {
      id: p.id,
      farmer: findUser(p.farmerId)?.name ?? t('activity.someFarmer'),
      crop: cropName(p.crop, t),
      lga: p.lga,
      payout: formatEth(p.payoutEth),
      premium: formatEth(p.premiumEth),
      threshold: formatMm(p.thresholdMm)
    };
    const base = { userId: viewer.id, href: `/${audience}/policies/${p.id}`, read: false };
    out.push({
      ...base,
      id: `activity:purchased:${p.id}:${viewer.id}`,
      kind: 'policy',
      title: t(`activity.${audience}.purchased.title`, vars),
      body: t(`activity.${audience}.purchased.body`, vars),
      createdAt: p.purchasedAtTime ?? `${p.purchasedAt}T00:00:00.000Z`
    });
    if (p.evaluation && p.status !== 'active') {
      const outcome = p.evaluation.triggered ? 'paid' : 'settled';
      const settledVars = { ...vars, rain: formatMm(p.evaluation.aggregateMm) };
      out.push({
        ...base,
        id: `activity:${outcome}:${p.id}:${viewer.id}`,
        kind: p.evaluation.triggered ? 'payout' : 'evaluation',
        title: t(`activity.${audience}.${outcome}.title`, settledVars),
        // An agent's sale pays the agent's wallet, so that farmer hears it from their agent.
        body: t(audience === 'farmer' && outcome === 'paid' && p.agentId ? 'activity.farmer.paidViaAgent.body' : `activity.${audience}.${outcome}.body`, settledVars),
        createdAt: p.evaluation.evaluatedAt
      });
    }
  }
  return out;
}
