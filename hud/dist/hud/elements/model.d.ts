/**
 * OMC HUD - Model Element
 *
 * Renders the current model name.
 */
import type { ModelFormat } from '../types.js';
/**
 * Format model name for display.
 * Converts model IDs to friendly names based on the requested format.
 */
export declare function formatModelName(modelId: string | null | undefined, format?: ModelFormat): string | null;
/**
 * Render model element.
 *
 * Output format: `💻 {display_name}`. The input is passed through
 * verbatim (no "(1M context)" stripping, no truncation, no tier
 * coloring); we simply prefix the emoji.
 */
export declare function renderModel(modelId: string | null | undefined, _format?: ModelFormat): string | null;
