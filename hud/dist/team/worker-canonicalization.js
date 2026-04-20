/**
 * Worker Canonicalization Stub
 *
 * Minimal dedup-by-name implementation for HUD plugin.
 * The full OMC version includes priority-based merging, alias normalization,
 * and field backfilling; this stub only deduplicates by worker name.
 */
export function canonicalizeWorkers(workers) {
    const seen = new Map();
    const duplicateNames = [];
    for (const worker of workers) {
        const name = typeof worker.name === 'string' ? worker.name.trim() : '';
        if (!name)
            continue;
        if (seen.has(name)) {
            if (!duplicateNames.includes(name))
                duplicateNames.push(name);
        }
        seen.set(name, worker);
    }
    return { workers: Array.from(seen.values()), duplicateNames };
}
export function canonicalizeTeamConfigWorkers(config) {
    const { workers, duplicateNames } = canonicalizeWorkers(config.workers ?? []);
    if (duplicateNames.length > 0) {
        console.warn(`[team] canonicalized duplicate worker entries: ${duplicateNames.join(', ')}`);
    }
    return { ...config, workers, worker_count: workers.length };
}
//# sourceMappingURL=worker-canonicalization.js.map