/**
 * Identity inference.
 *
 * Granola exposes no `/me` endpoint, so identity is guessed from the `owner`
 * field across a sample of recent notes. The most frequent owner is reported
 * as "likely you" — personal API keys see both your own notes and notes
 * shared with you (e.g. by a workspace admin), so this is probabilistic, not
 * ground truth.
 */

import type { GranolaClient } from './client.js';

export interface OwnerCount {
  name: string | null;
  email: string;
  count: number;
}

export interface IdentityGuess {
  sampleSize: number;
  likelyYou: OwnerCount | null;
  allOwners: OwnerCount[];
}

/**
 * Sample `sample` recent notes and tally owners.
 *
 * Returns the most frequent owner plus the full distribution so callers can
 * present an honest picture ("you, but also X shares a lot with you").
 */
export async function inferIdentity(
  client: GranolaClient,
  sample = 30,
): Promise<IdentityGuess> {
  const counts = new Map<string, OwnerCount>();
  let total = 0;
  for await (const note of client.notes.iterate({
    limit: sample,
    pageSize: Math.min(sample, 30),
  })) {
    total += 1;
    const owner = note.owner;
    const email = owner && typeof owner.email === 'string' ? owner.email : '';
    if (!email) continue;
    const existing = counts.get(email);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(email, {
        name: owner && typeof owner.name === 'string' ? owner.name : null,
        email,
        count: 1,
      });
    }
  }
  const allOwners = [...counts.values()].sort((a, b) => b.count - a.count);
  return {
    sampleSize: total,
    likelyYou: allOwners[0] ?? null,
    allOwners,
  };
}
