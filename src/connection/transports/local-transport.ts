import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { LocalMcpServerConfig } from '../../types/config.js';
import type { Transport, TransportConnector } from '../transport-factory.js';
import { log } from '../../utils/logger.js';

export class LocalTransportConnector implements TransportConnector<LocalMcpServerConfig> {
    async connect(server: LocalMcpServerConfig, client: Client): Promise<Transport> {
        log(`Connecting to local MCP server: ${server.name}`);

        if (!server.command || server.command.length === 0) {
            throw new Error(`Invalid local server config: ${server.name} - command array is empty`);
        }

        const [cmd, ...args] = server.command;

        const env: Record<string, string> = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined) env[key] = value;
        }
        if (server.env) {
            Object.assign(env, server.env);
        }

        const transport = new StdioClientTransport({ command: cmd, args, env });
        const handshakeTimeout = server.timeout ?? (cmd === 'npx' ? 180000 : undefined);

        try {
            await client.connect(transport, handshakeTimeout ? { timeout: handshakeTimeout } : undefined);
            log(`Connected to local server: ${server.name}`);
            return transport;
        } catch (err) {
            await this.closeTransport(transport);
            throw err;
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
