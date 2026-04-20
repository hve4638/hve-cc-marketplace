/**
 * OMC HUD - CWD Element
 *
 * Renders current working directory as `📁 {cwd}` where a leading
 * $HOME is replaced with `~`. Supports OSC 8 terminal hyperlinks
 * for terminals that understand them.
 */
import type { CwdFormat } from '../types.js';
/**
 * Render current working directory.
 *
 * Output format: `📁 {cwd}` where `{cwd}` has a leading $HOME
 * replaced with `~`, otherwise rendered verbatim.
 *
 * The `format` parameter is retained for call-site compatibility
 * but is ignored; the layout is fixed.
 *
 * @param cwd - Absolute path to current working directory
 * @param _format - Retained for compatibility; unused
 * @param useHyperlinks - Wrap the path in an OSC 8 hyperlink
 * @returns Formatted path string or null if empty
 */
export declare function renderCwd(cwd: string | undefined, _format?: CwdFormat, useHyperlinks?: boolean): string | null;
