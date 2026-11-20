import { branchAddons, getBranchAddon, plans } from '../shared/plans.js';

export { branchAddons, getBranchAddon, plans };

export function getPlan(planId) {
  return plans.find((plan) => plan.id === planId);
}

export function addCalendarMonths(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function trialEndsAt(startedAt) {
  return addCalendarMonths(startedAt, 1);
}

export function subscriptionStatus({ trialEndsAt: trialEnd, activeUntil, planId }, now = new Date()) {
  if (planId === 'lifetime') return 'lifetime';
  if (activeUntil && new Date(activeUntil) > now) return 'active';
  if (trialEnd && new Date(trialEnd) > now) return 'trial';
  return 'expired';
}
