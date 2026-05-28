import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface ServerConnection {
    client: Client;
    transport: { close(): void | Promise<void> };
}
