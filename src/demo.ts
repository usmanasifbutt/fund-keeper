import type { Holding } from './lib/calc';

/**
 * Sample holdings shown when the app is opened with #demo (e.g. https://…/fund-keeper/#demo).
 * Real MUFAP funds with made-up units and amounts. Nothing in demo mode is saved.
 */
export const DEMO_HOLDINGS: Holding[] = [
  { fundId: '12820', name: 'Meezan Cash Fund', units: 11300, invested: 549000, since: '2025-11-03' },
  { fundId: '12818', name: 'Meezan Islamic Income Fund', units: 5600, invested: 279500, since: '2026-01-12' },
  { fundId: '12733', name: 'Alhamra Islamic Stock Fund', units: 8700, invested: 261000, since: '2026-04-15' },
  { fundId: '12817', name: 'Meezan Islamic Fund', units: 1300, invested: 205000, since: '2025-10-20' },
  { fundId: '13082', name: 'NBP Islamic Money Market Fund', units: 14000, invested: 143350, since: '2026-07-14' },
  { fundId: '12725', name: 'Alhamra Islamic Asset Allocation Fund', units: 500, invested: 107200, since: '2026-07-14' },
];

export const isDemo = () => typeof location !== 'undefined' && location.hash === '#demo';
