/**
 * OMC HUD Type Definitions
 *
 * Type definitions for the HUD state, configuration, and rendering.
 */
import { DEFAULT_MISSION_BOARD_CONFIG } from './mission-board.js';
/**
 * Default element order matching the current hardcoded order in render.ts.
 * Used as fallback when no layout is configured.
 */
export const DEFAULT_ELEMENT_ORDER = {
    line1: ['hostname', 'cwd', 'gitRepo', 'gitBranch', 'gitStatus', 'model', 'apiKeySource', 'profile'],
    main: [
        'omcLabel', 'rateLimits', 'customBuckets', 'permission', 'thinking',
        'promptTime', 'session', 'tokens', 'ralph', 'autopilot', 'prd',
        'skills', 'lastSkill', 'contextBar', 'agents', 'background',
        'callCounts', 'lastTool', 'sessionSummary',
    ],
    detail: ['missionBoard', 'agents', 'contextWarning', 'todos'],
};
export const DEFAULT_HUD_USAGE_POLL_INTERVAL_MS = 90 * 1000;
export const DEFAULT_HUD_CONFIG = {
    preset: 'default',
    elements: {
        // -- Enabled for the default 3-line layout --
        cwd: true,
        cwdFormat: 'relative',
        useHyperlinks: false,
        gitBranch: true,
        model: true,
        modelFormat: 'short',
        rateLimits: true,
        contextBar: true,
        agents: true,
        agentsFormat: 'multiline',
        agentsMaxLines: 5,
        // -- Disabled for the default layout --
        gitRepo: false,
        gitStatus: false,
        gitInfoPosition: 'above',
        omcLabel: false,
        ralph: false,
        autopilot: false,
        prdStory: false,
        activeSkills: false,
        lastSkill: false,
        backgroundTasks: false,
        todos: false,
        permissionStatus: false,
        thinking: false,
        thinkingFormat: 'text',
        apiKeySource: false,
        hostname: false,
        profile: false,
        missionBoard: false,
        promptTime: false,
        sessionHealth: false,
        showSessionDuration: false,
        showHealthIndicator: false,
        showTokens: false,
        useBars: false,
        showCallCounts: false,
        callCountsFormat: 'auto',
        showLastTool: false,
        sessionSummary: false,
        maxOutputLines: 10,
        safeMode: true,
    },
    thresholds: {
        contextWarning: 70,
        contextCompactSuggestion: 80,
        contextCritical: 85,
        ralphWarning: 7,
    },
    staleTaskThresholdMinutes: 10,
    contextLimitWarning: {
        threshold: 80,
        autoCompact: false,
    },
    missionBoard: DEFAULT_MISSION_BOARD_CONFIG,
    usageApiPollIntervalMs: DEFAULT_HUD_USAGE_POLL_INTERVAL_MS,
    wrapMode: 'truncate',
};
/**
 * Preset overrides keyed by HudPreset. The default preset intentionally
 * passes an empty override object because `DEFAULT_HUD_CONFIG.elements`
 * already carries the desired defaults.
 */
export const PRESET_CONFIGS = {
    default: {},
};
//# sourceMappingURL=types.js.map