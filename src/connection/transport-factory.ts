import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BaseServerConfig } from '../types/config.js';

export interface Transport {
    close(): void | Promise<void>;
}

export interface TransportConnector<T extends BaseServerConfig> {
    connect(server: T, client: Client): Promise<Transport>;
}

export class TransportFactory {
    private connectors = new Map<string, TransportConnector<any>>();

    register<T extends BaseServerConfig>(type: string, connector: TransportConnector<T>): void {
        this.connectors.set(type, connector);
    }

    async connect<T extends BaseServerConfig>(server: T, client: Client): Promise<Transport> {
        const connector = this.connectors.get(server.type);
        if (!connector) {
            throw new Error(`No transport connector registered for type: ${server.type}`);
        }
        return connector.connect(server, client);
    }

    getSupportedTypes(): string[] {
        return Array.from(this.connectors.keys());
    }
}

export const defaultTransportFactory = new TransportFactory();
