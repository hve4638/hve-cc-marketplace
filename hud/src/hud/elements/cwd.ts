/**
 * OMC HUD - CWD Element
 *
 * Renders current working directory as `📁 {cwd}` where a leading
 * $HOME is replaced with `~`. Supports OSC 8 terminal hyperlinks
 * for terminals that understand them.
 */

import { homedir } from 'node:os';
import { basename } from 'node:path';
import type { CwdFormat } from '../types.js';

/**
 * Wrap text in an OSC 8 terminal hyperlink.
 * Supported by: iTerm2, WezTerm, Kitty, Hyper, Windows Terminal, VTE-based terminals.
 */
function osc8Link(url: string, text: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

/**
 * Convert an absolute filesystem path to a file:// URL.
 * Handles Windows paths (C:\path -> file:///C:/path).
 */
function pathToFileUrl(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}

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
export function renderCwd(
  cwd: string | undefined,
  _format: CwdFormat = 'relative',
  useHyperlinks = false
): string | null {
  if (!cwd) return null;

  const home = homedir();
  let displayPath: string;
  if (cwd === home) {
    displayPath = '~';
  } else if (cwd === '/' || cwd === '\\') {
    displayPath = '/';
  } else {
    displayPath = basename(cwd) || cwd;
  }

  const pathText = useHyperlinks
    ? osc8Link(pathToFileUrl(cwd), displayPath)
    : displayPath;

  return `📁 ${pathText}`;
}
