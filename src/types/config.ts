import type { PluginOptions } from '@opencode-ai/plugin';

export interface BaseServerConfig {
    name: string;
    type: string;
    timeout?: number;
}

/** How a local MCP server's stderr is handled. Omission keeps it silent. */
export type LocalMcpServerStderr = 'inherit';

export interface LocalMcpServerConfig extends BaseServerConfig {
    type: 'local';
    command: string[];
    env?: Record<string, string>;
    stderr?: LocalMcpServerStderr;
}

export interface RemoteMcpServerConfig extends BaseServerConfig {
    type: 'remote';
    url: string;
    headers?: Record<string, string>;
}

export type McpServerConfig = LocalMcpServerConfig | RemoteMcpServerConfig;

export type McpConfigEntry =
    | (Omit<LocalMcpServerConfig, 'name'> & { enabled?: boolean })
    | (Omit<RemoteMcpServerConfig, 'name'> & { enabled?: boolean });

export interface McpAdapterOptions extends PluginOptions {
    mcp?: Record<string, McpConfigEntry>;
}
