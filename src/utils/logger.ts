import { appendFileSync } from 'fs';

const DEBUG = process.env.OPENSTELLAR_MCP_DEBUG === 'true';
const LOG_FILE = '/tmp/openstellar-mcp-adapter.log';

export function log(message: string, data?: unknown) {
    if (!DEBUG) return;
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data, null, 2) : ''}\n`;
    try {
        appendFileSync(LOG_FILE, line);
    } catch {
        // ignore log write failures
    }
}
