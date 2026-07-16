import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Stream } from 'node:stream';
import type { LocalMcpServerConfig } from '../../types/config.js';
import type { Transport, TransportConnector } from '../transport-factory.js';
import { log } from '../../utils/logger.js';

export const STDERR_CAPTURE_LIMIT_BYTES = 8192;

export interface LocalTransportConnectorEffects {
    log?: typeof log;
}

export class LocalTransportConnector implements TransportConnector<LocalMcpServerConfig> {
    private readonly effects: Required<LocalTransportConnectorEffects>;

    constructor(effects: LocalTransportConnectorEffects = {}) {
        this.effects = { log: effects.log ?? log };
    }

    async connect(server: LocalMcpServerConfig, client: Client): Promise<Transport> {
        const { log: sink } = this.effects;
        sink(`Connecting to local MCP server: ${server.name}`);

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

        const transport = new StdioClientTransport({
            command: cmd,
            args,
            env,
            // Pipe diagnostics by default: the SDK keeps them off the terminal while
            // allowing us to retain a bounded failure trace. Stdout remains the MCP
            // JSON-RPC channel. `inherit` is the explicit live-diagnostics escape hatch.
            stderr: server.stderr === 'inherit' ? 'inherit' : 'pipe',
        });
        const stderrTrace = this.captureStderr(transport.stderr);
        const handshakeTimeout = server.timeout ?? (cmd === 'npx' ? 180000 : undefined);

        try {
            await client.connect(transport, handshakeTimeout ? { timeout: handshakeTimeout } : undefined);
            sink(`Connected to local server: ${server.name}`);
            return transport;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const trace = stderrTrace();
            if (trace) {
                sink(`Local MCP server stderr (${server.name})`, trace);
            }
            const guidance = ' Enable OPENSTELLAR_MCP_DEBUG=true for diagnostics or set stderr: "inherit" for live child stderr.';
            await this.closeTransport(transport);
            throw new Error(`Failed to connect to local MCP server ${server.name}: ${message}.${guidance}`, { cause: err });
        }
    }

    /**
     * Installs a data listener that retains at most {@link STDERR_CAPTURE_LIMIT_BYTES}
     * bytes of child stderr in memory and reports a `[stderr truncated]` marker when the
     * limit is exceeded. The listener remains active after the limit is reached so the
     * child never blocks on a full pipe.
     */
    captureStderr(stream: Stream | null): () => string {
        if (!stream || typeof (stream as Stream).on !== 'function') return () => '';

        const limit = STDERR_CAPTURE_LIMIT_BYTES;
        const retained: Buffer[] = [];
        let retainedBytes = 0;
        let totalBytes = 0;
        let truncated = false;

        const read = (chunk: Buffer | string) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buf.length;
            if (retainedBytes >= limit) {
                if (totalBytes > limit) truncated = true;
                return;
            }
            const remaining = limit - retainedBytes;
            if (buf.length <= remaining) {
                retained.push(buf);
                retainedBytes += buf.length;
            } else {
                retained.push(buf.subarray(0, remaining));
                retainedBytes += remaining;
            }
            if (retainedBytes >= limit && totalBytes > limit) truncated = true;
        };

        (stream as Stream).on('data', read);

        return () => Buffer.concat(retained, retainedBytes).toString('utf8') + (truncated ? '\n[stderr truncated]' : '');
    }

    private async closeTransport(transport: Transport): Promise<void> {
        try {
            await Promise.resolve(transport.close());
        } catch {
            // best-effort cleanup
        }
    }
}