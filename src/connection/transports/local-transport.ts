import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Stream } from 'node:stream';
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
            log(`Connected to local server: ${server.name}`);
            return transport;
        } catch (err) {
            if (stderrTrace()) {
                log(`Local MCP server stderr (${server.name})`, stderrTrace());
            }
            const message = err instanceof Error ? err.message : String(err);
            const guidance = ' Enable OPENSTELLAR_MCP_DEBUG=true for diagnostics or set stderr: "inherit" for live child stderr.';
            await this.closeTransport(transport);
            throw new Error(`Failed to connect to local MCP server ${server.name}: ${message}.${guidance}`, { cause: err });
        }
    }

    private captureStderr(stream: Stream | null): () => string {
        if (!stream || typeof stream.on !== 'function') return () => '';

        const limit = 8192;
        let captured = '';
        stream.on('data', (chunk: Buffer | string) => {
            if (captured.length >= limit) return;
            captured += chunk.toString().slice(0, limit - captured.length);
        });
        return () => captured + (captured.length >= limit ? '\n[stderr truncated]' : '');
    }

    private async closeTransport(transport: Transport): Promise<void> {
        try {
            await Promise.resolve(transport.close());
        } catch {
            // best-effort cleanup
        }
    }
}
