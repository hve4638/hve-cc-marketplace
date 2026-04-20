/**
 * OMC HUD - Token Usage Element
 *
 * Renders last-request input/output token usage from transcript metadata.
 */
function formatTokenCount(tokens) {
    if (tokens < 1000)
        return `${tokens}`;
    if (tokens < 1000000)
        return `${(tokens / 1000).toFixed(1)}k`;
    return `${(tokens / 1000000).toFixed(2)}M`;
}
export function renderTokenUsage(usage, sessionTotalTokens) {
    if (!usage)
        return null;
    const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
    if (!hasUsage)
        return null;
    const parts = [
        `tok:i${formatTokenCount(usage.inputTokens)}/o${formatTokenCount(usage.outputTokens)}`,
    ];
    if (usage.reasoningTokens && usage.reasoningTokens > 0) {
        parts.push(`r${formatTokenCount(usage.reasoningTokens)}`);
    }
    if (sessionTotalTokens && sessionTotalTokens > 0) {
        parts.push(`s${formatTokenCount(sessionTotalTokens)}`);
    }
    return parts.join(' ');
}
//# sourceMappingURL=token-usage.js.map