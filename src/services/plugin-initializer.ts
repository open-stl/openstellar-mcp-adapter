import { tool } from '@opencode-ai/plugin';
import type { BaseServerConfig } from '../types/config.js';
import type { ServerConnection } from '../types/connection.js';
import { connectToServer } from '../connection/connect-to-server.js';
import { convertMcpTool } from '../tool/convert-mcp-tool.js';
import { log } from '../utils/logger.js';
import type { Transport } from '../connection/transport-factory.js';
import { globalAdapterCache, type ServerCacheEntry } from '../connection/adapter-cache.js';

export interface InitializationResult {
    tools: Record<string, ReturnType<typeof tool>>;
    transports: Transport[];
    hadFailure: boolean;
}

interface ServerInitializationResult {
    tools: Record<string, ReturnType<typeof tool>>;
    transport?: Transport;
    failed: boolean;
}

export class PluginInitializer {
    async initialize(servers: BaseServerConfig[]): Promise<InitializationResult> {
        const tools: Record<string, ReturnType<typeof tool>> = {};

        const results = await Promise.all(
            servers.map((server) => this.initializeServer(server)),
        );

        const transports: Transport[] = [];
        let hadFailure = false;

        for (const result of results) {
            Object.assign(tools, result.tools);
            if (result.transport) transports.push(result.transport);
            hadFailure = hadFailure || result.failed;
        }

        log(`Total tools registered: ${Object.keys(tools).length}`);
        return { tools, transports, hadFailure };
    }

    private async initializeServer(server: BaseServerConfig): Promise<ServerInitializationResult> {
        const serverKey = globalAdapterCache.getServerKey(server);

        try {
            const hadCachedEntry = globalAdapterCache.get(serverKey) !== undefined;
            const entry = await globalAdapterCache.getOrCreate(serverKey, async () => {
                if (hadCachedEntry) {
                    log(`[${server.name}] Cached connection failed keepalive; reconnecting`);
                } else {
                    log(`[${server.name}] Starting fresh connection`);
                }

                return this.connectAndCacheServer(server);
            });

            if (!hadCachedEntry) {
                log(`[${server.name}] Returning fresh server tools`);
            } else {
                log(`[${server.name}] Returning cached server tools`);
            }

            return {
                tools: entry.tools,
                transport: entry.transport,
                failed: false,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log(`Failed to connect to ${server.name}: ${msg}`);
            return { tools: {}, failed: true };
        }
    }

    private async connectAndCacheServer(server: BaseServerConfig): Promise<ServerCacheEntry> {
        let connection: ServerConnection | undefined;

        try {
            connection = await connectToServer(server);
            const toolsResult = await connection.client.listTools();

            const serverTools: Record<string, ReturnType<typeof tool>> = {};

            /**
             * Builds a deduplicated tool name: strips ALL tokens from the MCP tool
             * name that appear in the server name, regardless of position — preventing
             * double prefixes like `notion_notion_search`, suffixes like
             * `exa_web_fetch_exa`, and mid-name repeats.
             *
             * Falls back to the raw `<server>_<tool>` form if stripping would produce
             * a name that collides with an already-registered tool from the same server.
             */
            function buildToolName(serverName: string, mcpToolName: string): string {
                const serverNorm = serverName.replace(/-/g, '_');
                const raw = mcpToolName.replace(/-/g, '_');
                const serverParts = new Set(serverNorm.split('_'));
                const toolParts = raw.split('_');

                const filtered = toolParts.filter((part) => !serverParts.has(part));
                const stripped = filtered.join('_');
                const deduped = stripped ? `${serverNorm}_${stripped}` : serverNorm;

                // Collision guard: if the deduped name is already taken, fall back to raw
                if (serverTools[deduped]) {
                    return `${serverNorm}_${raw}`;
                }
                return deduped;
            }

            for (const mcpTool of toolsResult.tools) {
                const toolName = buildToolName(server.name, mcpTool.name);
                serverTools[toolName] = convertMcpTool(mcpTool, connection.client, server.timeout);
            }

            log(`[${server.name}] Successfully registered ${toolsResult.tools.length} tools`);

            return {
                tools: serverTools,
                transport: connection.transport,
                client: connection.client,
            };
        } catch (error) {
            if (connection) {
                await this.closeTransport(connection.transport);
            }
            throw error;
        }
    }

    private async closeTransport(transport: Transport): Promise<void> {
        try {
            await Promise.resolve(transport.close());
        } catch {
            // best-effort cleanup
        }
    }
}
