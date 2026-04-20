/**
 * OMC HUD - Rate Limits Element
 *
 * Renders 5-hour and weekly rate limit usage display (built-in providers),
 * and custom rate limit buckets from the rateLimitsProvider command.
 */
import type { RateLimits, CustomProviderResult, UsageResult } from '../types.js';
/**
 * Format reset time as human-readable duration.
 * Returns null if date is null/undefined or in the past.
 */
export declare function formatResetTime(date: Date | null | undefined): string | null;
/**
 * Render rate limits display.
 *
 * Format: 5h:45%(3h42m) wk:12%(2d5h) mo:8%(15d3h) sn:20%(1d2h) op:5%(1d2h)
 */
export declare function renderRateLimits(limits: RateLimits | null, stale?: boolean): string | null;
/**
 * Render compact rate limits (just percentages).
 *
 * Format: 45%/12% or 45%/12%/8%/20%/5% (5h/wk/mo/sn/op)
 */
export declare function renderRateLimitsCompact(limits: RateLimits | null, stale?: boolean): string | null;
/**
 * Render compact rate limits for the custom 3-line default layout.
 *
 * Output format: `⏳ 5h: {pct}%({remaining}) wk:{pct}%({remaining})`
 * - Only 5h and weekly buckets are considered; others are ignored.
 * - The weekly segment is omitted when `weeklyPercent` is missing.
 * - Percentages are colored with the existing getColor() thresholds.
 * - The remaining-time portion is only rendered when a future reset
 *   time is available (formatResetTime returns non-null).
 */
export declare function renderRateLimitsCompactCustom(limits: RateLimits | null, stale?: boolean): string | null;
/**
 * Render rate limits with visual progress bars.
 *
 * Format: 5h:[████░░░░░░]45%(3h42m) wk:[█░░░░░░░░░]12%(2d5h) mo:[░░░░░░░░░░]8%(15d3h) sn:[██░░░░░░░░]20%(1d2h) op:[░░░░░░░░░░]5%(1d2h)
 */
export declare function renderRateLimitsWithBar(limits: RateLimits | null, barWidth?: number, stale?: boolean): string | null;
/**
 * Render an error indicator when the built-in rate limit API call fails.
 *
 * - 'network': API timeout, HTTP error, or parse failure → [API err]
 * - 'auth': credentials expired, refresh failed → [API auth]
 * - 'no_credentials': no OAuth credentials (expected for API key users) → null (no display)
 */
export declare function renderRateLimitsError(result: UsageResult | null): string | null;
/**
 * Render custom rate limit buckets from the rateLimitsProvider command.
 *
 * Format (normal):  label:32%  label2:250/300  label3:as-is
 * Format (stale):   label:32%*  (asterisk marks stale/cached data)
 * Format (error):   [cmd:err]
 *
 * resetsAt is shown only when usage exceeds thresholdPercent (default 85).
 */
export declare function renderCustomBuckets(result: CustomProviderResult, thresholdPercent?: number): string | null;
