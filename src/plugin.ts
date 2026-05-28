import type { Plugin, PluginOptions } from '@opencode-ai/plugin';
import type { McpAdapterOptions } from './types/index.js';
import { log } from './utils/logger.js';
import { normalizeServerConfig } from './utils/normalize-config.js';
import { globalAdapterCache } from './connection/adapter-cache.js';
import { PluginInitializer } from './services/plugin-initializer.js';
import { registerDefaultTransports } from './connection/transports/index.js';

registerDefaultTransports();

export const McpAdapterPlugin: Plugin = async (_ctx, options?: PluginOptions) => {
    log('=== MCP Adapter Plugin Starting ===');

    const opts = options as McpAdapterOptions;
    const servers = normalizeServerConfig(opts);

    if (servers.length === 0) {
        log('No MCP servers configured in plugin options');
        return {};
    }

    const cacheKey = globalAdapterCache.getCacheKey(servers);
    const cached = globalAdapterCache.get(cacheKey);

    if (cached) {
        log('Returning cached MCP adapter promise');
        return cached.promise;
    }

    await globalAdapterCache.closeAllTransports();
    globalAdapterCache.clear();

    const initializer = new PluginInitializer();

    const initPromise = (async () => {
        const result = await initializer.initialize(servers);

        const entry = globalAdapterCache.get(cacheKey);
        if (entry) {
            entry.transports.push(...result.transports);
        }

        if (result.hadFailure) {
            await globalAdapterCache.delete(cacheKey);
            log('One or more servers failed — clearing cache to allow retry');
        }

        log('=== MCP Adapter Plugin Initialization Complete ===');
        return { tool: result.tools };
    })();

    globalAdapterCache.set(cacheKey, {
        promise: initPromise,
        transports: [],
    });

    return initPromise as Promise<Record<string, unknown>>;
};
