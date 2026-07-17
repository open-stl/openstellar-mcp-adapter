import type { Plugin, PluginOptions } from '@opencode-ai/plugin';
import type { McpAdapterOptions } from './types/index.js';
import { log } from './utils/logger.js';
import { normalizeServerConfig } from './utils/normalize-config.js';
import { PluginInitializer } from './services/plugin-initializer.js';
import { registerDefaultTransports } from './connection/transports/index.js';
import { checkForUpdate, formatUpdateMessage } from './hooks/auto-update-checker.js';

registerDefaultTransports();

let hasCheckedForUpdate = false;

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
    return {
        tool: result.tools,
        event: async ({ event }) => {
            if (event.type !== 'session.created') return;
            if (hasCheckedForUpdate) return;
            hasCheckedForUpdate = true;

            const result = await checkForUpdate();
            if (result.outcome !== 'up-to-date') {
                log(`[auto-update] outcome=${result.outcome}${result.error ? ` error=${result.error}` : ''}`);
            }
            if (result.outcome === 'update-staged' && result.latestVersion) {
                log(`[auto-update] Update available: ${result.currentVersion} -> ${result.latestVersion}. Cache invalidated.`);
                const msg = formatUpdateMessage(result);
                try {
                    if ('client' in _ctx && _ctx.client && 'tui' in _ctx.client) {
                        const tui = (_ctx.client as any).tui;
                        if (typeof tui?.showToast === 'function') {
                            await tui.showToast({ body: msg });
                        }
                    }
                } catch {
                    log('[auto-update] Failed to show toast notification');
                }
            }
        },
    };
};
