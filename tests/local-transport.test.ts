import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';
import { LocalTransportConnector } from '../src/connection/transports/local-transport.js';

const fixture = resolve('tests/fixtures/stdio-mcp-server.mjs');

async function connectFixture(stderr: 'inherit' | undefined) {
    const client = new Client({ name: 'local-transport-test', version: '1.0.0' });
    const connector = new LocalTransportConnector();
    const transport = await connector.connect({
        name: 'fixture',
        type: 'local',
        command: [process.execPath, fixture],
        ...(stderr ? { stderr } : {}),
    } as any, client);
    return { client, transport: transport as StdioClientTransport };
}

describe('LocalTransportConnector', () => {
    it('keeps fixture stderr off the terminal while completing MCP handshake and discovery', async () => {
        const { client, transport } = await connectFixture(undefined);
        try {
            expect(transport.stderr).not.toBeNull();
            const result = await client.listTools();
            expect(result.tools).toEqual([]);
        } finally {
            await client.close();
        }
    });

    it('uses inherited stderr when explicitly configured', async () => {
        const { client, transport } = await connectFixture('inherit');
        try {
            // Node spawn exposes no readable child stderr stream for inherited routing;
            // this directly verifies the SDK's stdio semantics without capturing the host terminal.
            expect(transport.stderr).toBeNull();
            expect((transport as any).pid).toBeTypeOf('number');
        } finally {
            await client.close();
        }
    });
});
