import type { Tier, TimelinePoint } from './types.ts';

/** Last timeline point at or before `at` (the first point when `at` precedes the data). Points ascend by time. */
export function snapshotAt(points: TimelinePoint[], at: number): TimelinePoint | null {
  let hit = points[0] ?? null;
  for (const p of points) {
    if (p.at > at) break;
    hit = p;
  }
  return hit;
}

/** "Repos one install from malware": LOCKED + WOULD_PULL (MAINTAINER has no known bad version yet). */
export const exposedCount = (c: Record<Tier, number>): number => c.LOCKED + c.WOULD_PULL;

/** Stable key for "has the exposure picture changed": exposure lists are only re-fetched when this changes. */
export const countsKey = (c: Record<Tier, number>): string => `${c.LOCKED}/${c.WOULD_PULL}/${c.MAINTAINER}`;
