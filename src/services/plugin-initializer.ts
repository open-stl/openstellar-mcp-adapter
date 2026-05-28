import { tool } from '@opencode-ai/plugin';
import type { BaseServerConfig } from '../types/config.js';
import type { ServerConnection } from '../types/connection.js';
import { connectToServer } from '../connection/connect-to-server.js';
import { convertMcpTool } from '../tool/convert-mcp-tool.js';
import { log } from '../utils/logger.js';
import type { Transport } from '../connection/transport-factory.js';

export interface InitializationResult {
    tools: Record<string, ReturnType<typeof tool>>;
    transports: Transport[];
    hadFailure: boolean;
}

export class PluginInitializer {
    async initialize(servers: BaseServerConfig[]): Promise<InitializationResult> {
        const tools: Record<string, ReturnType<typeof tool>> = {};
        const transports: Transport[] = [];
        let hadFailure = false;

        const connectionPromises = servers.map(async (server) => {
            let connection: ServerConnection | undefined;
            try {
                connection = await connectToServer(server);
                transports.push(connection.transport);

                const toolsResult = await connection.client.listTools();

                const serverTools: Record<string, ReturnType<typeof tool>> = {};
                for (const mcpTool of toolsResult.tools) {
                    const toolName = `${server.name}_${mcpTool.name}`.replace(/-/g, '_');
                    serverTools[toolName] = convertMcpTool(mcpTool, connection.client);
                }

                log(`Registered ${toolsResult.tools.length} tools from ${server.name}`);
                return serverTools;
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                log(`Failed to connect to ${server.name}: ${msg}`);
                hadFailure = true;

                if (connection) {
                    await this.closeTransport(connection.transport);
                    const idx = transports.indexOf(connection.transport);
                    if (idx >= 0) {
                        transports.splice(idx, 1);
                    }
                }

                return {};
            }
        });

        const allToolsResults = await Promise.all(connectionPromises);

        for (const serverTools of allToolsResults) {
            Object.assign(tools, serverTools);
        }

        log(`Total tools registered: ${Object.keys(tools).length}`);
        return { tools, transports, hadFailure };
    }

    private async closeTransport(transport: Transport): Promise<void> {
        try {
            await Promise.resolve(transport.close());
        } catch {
            // best-effort cleanup
        }
    }
}
