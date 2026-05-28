import type { PluginOptions } from '@opencode-ai/plugin';

export interface BaseServerConfig {
    name: string;
    type: string;
    timeout?: number;
}

export interface LocalMcpServerConfig extends BaseServerConfig {
    type: 'local';
    command: string[];
    env?: Record<string, string>;
}

export interface RemoteMcpServerConfig extends BaseServerConfig {
    type: 'remote';
    url: string;
    headers?: Record<string, string>;
}

export type McpServerConfig = LocalMcpServerConfig | RemoteMcpServerConfig;

export type McpConfigEntry =
    | Omit<LocalMcpServerConfig, 'name'>
    | Omit<RemoteMcpServerConfig, 'name'>;

export interface McpAdapterOptions extends PluginOptions {
    mcp?: Record<string, McpConfigEntry>;
}
