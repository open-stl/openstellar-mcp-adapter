import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BaseServerConfig } from '../types/config.js';
import type { ServerConnection } from '../types/connection.js';
import { defaultTransportFactory } from './transport-factory.js';

export async function connectToServer(server: BaseServerConfig): Promise<ServerConnection> {
    const client = new Client({ name: 'openstellar-mcp-adapter', version: '0.1.0' });
    const transport = await defaultTransportFactory.connect(server, client);
    return { client, transport };
}
