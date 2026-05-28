import type { BaseServerConfig } from '../types/config.js';

export function normalizeServerConfig(
    options: { mcp?: Record<string, unknown> } | undefined
): BaseServerConfig[] {
    if (!options?.mcp || typeof options.mcp !== 'object' || Array.isArray(options.mcp)) {
        return [];
    }

    const servers: BaseServerConfig[] = [];
    for (const [name, config] of Object.entries(options.mcp)) {
        if (config && typeof config === 'object') {
            servers.push({
                ...(config as Record<string, unknown>),
                name,
            } as BaseServerConfig);
        }
    }
    return servers;
}
