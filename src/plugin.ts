import type { Plugin, PluginOptions } from '@opencode-ai/plugin';
import type { McpAdapterOptions } from './types/index.js';
import { log } from './utils/logger.js';
import { normalizeServerConfig } from './utils/normalize-config.js';
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

    const initializer = new PluginInitializer();
    const result = await initializer.initialize(servers);

    log('=== MCP Adapter Plugin Initialization Complete ===');
    return { tool: result.tools };
};
