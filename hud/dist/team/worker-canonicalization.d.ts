/**
 * Worker Canonicalization Stub
 *
 * Minimal dedup-by-name implementation for HUD plugin.
 * The full OMC version includes priority-based merging, alias normalization,
 * and field backfilling; this stub only deduplicates by worker name.
 */
export interface WorkerCanonicalizationResult<T extends {
    name: string;
} = {
    name: string;
    [key: string]: unknown;
}> {
    workers: T[];
    duplicateNames: string[];
}
export declare function canonicalizeWorkers<T extends {
    name: string;
}>(workers: T[]): WorkerCanonicalizationResult<T>;
export declare function canonicalizeTeamConfigWorkers<T extends {
    workers?: Array<{
        name: string;
        [key: string]: unknown;
    }>;
    worker_count?: number;
}>(config: T): T;
