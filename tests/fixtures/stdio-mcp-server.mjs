const marker = process.env.MCP_TEST_STDERR_MARKER ?? 'fixture stderr';
process.stderr.write(`${marker}\n`);

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const request = JSON.parse(line);
        const result = request.method === 'initialize'
            ? { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1.0.0' } }
            : request.method === 'tools/list'
                ? { tools: [] }
                : {};
        if (request.id !== undefined) {
            process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`);
        }
    }
});
