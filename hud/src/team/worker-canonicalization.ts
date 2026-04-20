/**
 * Worker Canonicalization Stub
 *
 * Minimal dedup-by-name implementation for HUD plugin.
 * The full OMC version includes priority-based merging, alias normalization,
 * and field backfilling; this stub only deduplicates by worker name.
 */

export interface WorkerCanonicalizationResult<T extends { name: string } = { name: string; [key: string]: unknown }> {
  workers: T[];
  duplicateNames: string[];
}

export function canonicalizeWorkers<T extends { name: string }>(
  workers: T[],
): WorkerCanonicalizationResult<T> {
  const seen = new Map<string, T>();
  const duplicateNames: string[] = [];
  for (const worker of workers) {
    const name = typeof worker.name === 'string' ? worker.name.trim() : '';
    if (!name) continue;
    if (seen.has(name)) {
      if (!duplicateNames.includes(name)) duplicateNames.push(name);
    }
    seen.set(name, worker);
  }
  return { workers: Array.from(seen.values()), duplicateNames };
}

export function canonicalizeTeamConfigWorkers<
  T extends { workers?: Array<{ name: string; [key: string]: unknown }>; worker_count?: number },
>(config: T): T {
  const { workers, duplicateNames } = canonicalizeWorkers(config.workers ?? []);
  if (duplicateNames.length > 0) {
    console.warn(
      `[team] canonicalized duplicate worker entries: ${duplicateNames.join(', ')}`,
    );
  }
  return { ...config, workers, worker_count: workers.length };
}
