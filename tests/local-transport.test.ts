import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LocalTransportConnector, STDERR_CAPTURE_LIMIT_BYTES } from '../src/connection/transports/local-transport.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, 'fixtures/stdio-mcp-server.mjs');

async function connectFixture(stderr: 'inherit' | undefined, logImpl = vi.fn()) {
    const client = new Client({ name: 'local-transport-test', version: '1.0.0' });
    const connector = new LocalTransportConnector({ log: logImpl });
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

    describe('captureStderr', () => {
        function drive(stream: PassThrough, bytes: Buffer) {
            return new Promise<void>((resolve) => {
                stream.write(bytes);
                // Allow 'data' event delivery before reading.
                setImmediate(resolve);
            });
        }

        it('retains initial content up to the limit and discards later bytes', async () => {
            const stream = new PassThrough();
            const trace = new LocalTransportConnector().captureStderr(stream);
            const initial = Buffer.alloc(STDERR_CAPTURE_LIMIT_BYTES, 0x41); // 8192 'A'
            await drive(stream, initial);
            await drive(stream, Buffer.from('BBBB-should-be-truncated'));
            // Wait for the late chunk's data event.
            await new Promise((resolve) => setImmediate(resolve));
            const output = trace();
            expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(STDERR_CAPTURE_LIMIT_BYTES + '[stderr truncated]'.length + 1);
            expect(output.startsWith('A'.repeat(STDERR_CAPTURE_LIMIT_BYTES))).toBe(true);
            expect(output).toContain('[stderr truncated]');
            expect(output).not.toContain('BBBB');
        });

        it('does not report truncation when total bytes fit within the limit', async () => {
            const stream = new PassThrough();
            const trace = new LocalTransportConnector().captureStderr(stream);
            await drive(stream, Buffer.from('hello world'));
            expect(trace()).toBe('hello world');
        });

        it('counts UTF-8 bytes, not string characters', async () => {
            const stream = new PassThrough();
            const trace = new LocalTransportConnector().captureStderr(stream);
            // '日' is 3 bytes in UTF-8 but 1 character in UTF-16.
            const multibyte = Buffer.from('日本語');
            await drive(stream, multibyte);
            await drive(stream, Buffer.alloc(STDERR_CAPTURE_LIMIT_BYTES, 'x'));
            await drive(stream, Buffer.from('overflow-marker'));
            await new Promise((resolve) => setImmediate(resolve));
            const output = trace();
            const retainedBytes = Buffer.byteLength(output.split('\n[stderr truncated]')[0], 'utf8');
            expect(retainedBytes).toBeLessThanOrEqual(STDERR_CAPTURE_LIMIT_BYTES);
            expect(output).toContain('[stderr truncated]');
        });

        it('keeps draining the stream after the retention limit is reached', async () => {
            const stream = new PassThrough();
            const listenerSpy = vi.spyOn(stream, 'on');
            const trace = new LocalTransportConnector().captureStderr(stream);
            await drive(stream, Buffer.alloc(STDERR_CAPTURE_LIMIT_BYTES + 1024, 'x'));
            await new Promise((resolve) => setImmediate(resolve));
            expect(listenerSpy).toHaveBeenCalledWith('data', expect.any(Function));
            expect(trace()).toContain('[stderr truncated]');
        });

        it('returns an empty getter when the stream is null or lacks `on`', () => {
            const connector = new LocalTransportConnector();
            expect(connector.captureStderr(null)()).toBe('');
            expect(connector.captureStderr({} as any)()).toBe('');
        });
    });

    describe('failed handshake', () => {
        it('logs the captured stderr via the injected logger and closes the transport', async () => {
            const logSpy = vi.fn();
            const client = new Client({ name: 'failing', version: '1.0.0' });
            const connector = new LocalTransportConnector({ log: logSpy });
            const closeSpy = vi.spyOn(StdioClientTransport.prototype, 'close');

            let rejection: Error | undefined;
            try {
                await connector.connect({
                    name: 'missing-binary',
                    type: 'local',
                    command: [process.execPath, '--no-warnings', '-e', 'process.stderr.write("marker-handshake-failure\\n"); process.exit(1);'],
                    timeout: 2000,
                } as any, client);
            } catch (err) {
                rejection = err as Error;
            }

            expect(rejection).toBeDefined();
            expect(rejection!.message).toMatch(/Failed to connect to local MCP server missing-binary/);
            expect(rejection!.message).toContain('OPENSTELLAR_MCP_DEBUG');
            expect(rejection!.message).not.toContain('marker-handshake-failure');

            expect(closeSpy).toHaveBeenCalled();
            const callsText = logSpy.mock.calls.map((args) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')).join('\n');
            expect(callsText).toContain('marker-handshake-failure');
            expect(callsText).toContain('Local MCP server stderr');
            closeSpy.mockRestore();
        });
    });
});