/**
 * OMC HUD - Context Element
 *
 * Renders context window usage display.
 */
import type { HudThresholds } from '../types.js';
/**
 * Reset cached context display state.
 * Useful for test isolation and fresh render sessions.
 */
export declare function resetContextDisplayState(): void;
/**
 * Apply display-layer hysteresis so small refresh-to-refresh ctx fluctuations
 * do not visibly jitter in the HUD.
 */
export declare function getStableContextDisplayPercent(percent: number, thresholds: HudThresholds, displayScope?: string | null): number;
/**
 * Render context window percentage.
 *
 * Format: `📦 context:{pct}%`
 * Percentage is colored with the existing green/yellow/red thresholds.
 * The severity suffix (e.g. " CRITICAL") is intentionally dropped for
 * the compact default layout.
 */
export declare function renderContext(percent: number, thresholds: HudThresholds, displayScope?: string | null): string | null;
/**
 * Render context window with visual bar.
 *
 * Format: ctx:[████░░░░░░]67%
 */
export declare function renderContextWithBar(percent: number, thresholds: HudThresholds, barWidth?: number, displayScope?: string | null): string | null;
