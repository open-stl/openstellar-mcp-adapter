export { McpAdapterPlugin } from './plugin.js';
export { jsonSchemaToZod } from './schema/index.js';
export { convertMcpTool } from './tool/index.js';
export type { 
    McpServerConfig, 
    McpAdapterOptions, 
    McpConfigEntry,
    LocalMcpServerConfig, 
    RemoteMcpServerConfig, 
    BaseServerConfig 
} from './types/index.js';
export { TransportFactory } from './connection/transport-factory.js';
export type { Transport, TransportConnector } from './connection/transport-factory.js';
export { registerDefaultTransports } from './connection/transports/index.js';

import { McpAdapterPlugin } from './plugin.js';
export default McpAdapterPlugin;
