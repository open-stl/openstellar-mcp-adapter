import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BaseServerConfig } from '../types/config.js';
import type { ServerConnection } from '../types/connection.js';
import { defaultTransportFactory } from './transport-factory.js';

declare const PACKAGE_VERSION: string;

export async function connectToServer(server: BaseServerConfig): Promise<ServerConnection> {
    const client = new Client({ name: 'openstellar-mcp-adapter', version: PACKAGE_VERSION });
    const transport = await defaultTransportFactory.connect(server, client);
    return { client, transport };
}
