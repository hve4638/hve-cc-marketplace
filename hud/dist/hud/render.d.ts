/**
 * OMC HUD - Main Renderer
 *
 * Composes the statusline output. Produces a single-line layout plus
 * optional agent tree:
 *
 *   Line 1: 📁 {cwd} | ⏳5h:... wk:... | 🍵 Context: {pct}% | 💻 {model}
 *   Line 2+: agents multiline tree (omitted when no agents are running)
 */
import type { HudRenderContext, HudConfig } from "./types.js";
/**
 * Truncate a single line to a maximum visual width, preserving ANSI escape codes.
 */
export declare function truncateLineToMaxWidth(line: string, maxWidth: number): string;
/**
 * Limit output lines to prevent input field shrinkage.
 * Preserves the first line and trims from the end with a count marker.
 */
export declare function limitOutputLines(lines: string[], maxLines?: number): string[];
/**
 * Render the complete statusline using the fixed default 3-line layout.
 */
export declare function render(context: HudRenderContext, config: HudConfig): Promise<string>;
