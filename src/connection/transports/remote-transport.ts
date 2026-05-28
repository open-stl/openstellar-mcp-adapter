import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { RemoteMcpServerConfig } from '../../types/config.js';
import type { Transport, TransportConnector } from '../transport-factory.js';
import { log } from '../../utils/logger.js';

export class RemoteTransportConnector implements TransportConnector<RemoteMcpServerConfig> {
    async connect(server: RemoteMcpServerConfig, client: Client): Promise<Transport> {
        log(`Connecting to remote MCP server: ${server.name}`);

        const transportOpts = server.headers
            ? { requestInit: { headers: server.headers } as RequestInit }
            : undefined;

        const transport = new StreamableHTTPClientTransport(new URL(server.url), transportOpts);
        const handshakeTimeout = server.timeout;

        try {
            await client.connect(transport, handshakeTimeout ? { timeout: handshakeTimeout } : undefined);
            log(`Connected to remote server: ${server.name}`);
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
