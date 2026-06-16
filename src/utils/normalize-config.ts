import type { BaseServerConfig, McpConfigEntry } from '../types/config.js';
import { log } from './logger.js';

export function normalizeServerConfig(
    options: { mcp?: Record<string, unknown> } | undefined
): BaseServerConfig[] {
    if (!options?.mcp || typeof options.mcp !== 'object' || Array.isArray(options.mcp)) {
        return [];
    }

    const servers: BaseServerConfig[] = [];
    for (const [name, config] of Object.entries(options.mcp)) {
        if (!config || typeof config !== 'object') continue;
        const entry = config as McpConfigEntry;
        // Honor opencode's MCP `enabled` flag: skip servers explicitly disabled.
        // Without this filter, every configured server would be connected even
        // when the user has marked `enabled: false` in opencode.jsonc.
        if (entry.enabled === false) {
            log(`[${name}] Skipped (enabled: false)`);
            continue;
        }
        // Strip `enabled` so it does not leak into BaseServerConfig.
        const { enabled: _enabled, ...rest } = entry;
        servers.push({
            ...rest,
            name,
        } as BaseServerConfig);
    }
    return servers;
}
