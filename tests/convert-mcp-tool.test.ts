import { describe, expect, it, vi } from 'vitest';
import { convertMcpTool } from '../src/tool/convert-mcp-tool.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Standard mock — no delay, results passed as first arg (preserves original call sites)
function createMockClient(results?: unknown[]): Client {
  let callIndex = 0;
  return {
    callTool: async () => {
      if (results && callIndex < results.length) {
        return results[callIndex++];
      }
      return { content: [{ type: 'text', text: 'mock' }] };
    },
  } as unknown as Client;
}

// Delayed mock for timeout testing — simulates MCP SDK timeout behavior
function createDelayedMockClient(delayMs: number, results?: unknown[]): Client {
  let callIndex = 0;
  return {
    callTool: async (...args: unknown[]) => {
      const options = args[2] as { timeout?: number } | undefined;
      return new Promise((resolve, reject) => {
        const done = setTimeout(() => {
          if (results && callIndex < results.length) {
            resolve(results[callIndex++]);
          } else {
            resolve({ content: [{ type: 'text', text: 'mock' }] });
          }
        }, delayMs);

        // If timeout option is set, reject when timeout fires (simulating MCP SDK behavior)
        if (options?.timeout && options.timeout > 0) {
          setTimeout(() => {
            clearTimeout(done);
            reject(new Error(`Timed out in ${options.timeout}ms`));
          }, options.timeout);
        }
      });
    },
  } as unknown as Client;
}

describe('convertMcpTool', () => {
  it('creates a tool with correct name and description', () => {
    const tool = convertMcpTool(
      { name: 'test_tool', description: 'A test tool', inputSchema: { type: 'object', properties: {} } },
      createMockClient(),
    );
    expect(tool.description).toBe('A test tool');
  });

  it('creates a tool with empty inputSchema as empty args', () => {
    const tool = convertMcpTool(
      { name: 'empty_schema', description: 'No schema' },
      createMockClient(),
    );
    expect(tool.args).toBeDefined();
  });

  it('creates a tool with typed args from inputSchema', () => {
    const tool = convertMcpTool(
      {
        name: 'typed_tool',
        description: 'Has params',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
      createMockClient(),
    );
    expect(tool.args).toBeDefined();
    expect(tool.args?.query).toBeDefined();
  });

  it('execute returns text content on success', async () => {
    const mockClient = createMockClient([
      { content: [{ type: 'text', text: 'Hello world' }] },
    ]);
    const tool = convertMcpTool(
      { name: 'echo', description: 'Echo', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toBe('Hello world');
  });

  it('execute joins multiple text parts with double newline', async () => {
    const mockClient = createMockClient([
      { content: [{ type: 'text', text: 'Part 1' }, { type: 'text', text: 'Part 2' }] },
    ]);
    const tool = convertMcpTool(
      { name: 'multi', description: 'Multi part', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toBe('Part 1\n\nPart 2');
  });

  it('execute throws on error response', async () => {
    const mockClient = createMockClient([
      {
        isError: true,
        content: [{ type: 'text', text: 'Something went wrong' }],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'failing', description: 'Fails', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    await expect(tool.execute({}, undefined)).rejects.toThrow('MCP tool "failing" error: Something went wrong');
  });

  it('execute returns "No output" when content is empty', async () => {
    const mockClient = createMockClient([
      { content: [] },
    ]);
    const tool = convertMcpTool(
      { name: 'empty', description: 'Empty', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toBe('No output');
  });

  it('execute returns structuredContent when no text content', async () => {
    const mockClient = createMockClient([
      { content: [], structuredContent: { key: 'value' } },
    ]);
    const tool = convertMcpTool(
      { name: 'structured', description: 'Structured', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(JSON.parse(result as string)).toEqual({ key: 'value' });
  });

  it('uses empty description when mcpTool.description is undefined', () => {
    const tool = convertMcpTool(
      { name: 'no_desc', inputSchema: { type: 'object', properties: {} } },
      createMockClient(),
    );
    expect(tool.description).toBe('');
  });

  it('times out when tool exceeds timeout', async () => {
    // Mock client that takes 500ms to respond, but timeout is 50ms
    const mockClient = createDelayedMockClient(500);
    const tool = convertMcpTool(
      { name: 'slow_tool', description: 'Slow', inputSchema: { type: 'object', properties: {} } },
      mockClient,
      50,
    );
    await expect(tool.execute({}, undefined)).rejects.toThrow(
      'MCP tool "slow_tool" timed out after 50ms',
    );
  }, 10000); // Give plenty of time for this async test

  it('extracts image content as [image: mimeType]', async () => {
    const mockClient = createMockClient([
      {
        content: [
          { type: 'image', data: 'base64datahere', mimeType: 'image/png' },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'img', description: 'Returns image', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toContain('[image: image/png]');
    expect(result).toContain('base64 data');
  });

  it('extracts audio content as [audio: mimeType]', async () => {
    const mockClient = createMockClient([
      {
        content: [
          { type: 'audio', data: 'base64audiodata', mimeType: 'audio/mpeg' },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'aud', description: 'Returns audio', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toContain('[audio: audio/mpeg]');
    expect(result).toContain('base64 data');
  });

  it('extracts embedded resource with text', async () => {
    const mockClient = createMockClient([
      {
        content: [
          {
            type: 'resource',
            resource: { uri: 'file:///hello.txt', mimeType: 'text/plain', text: 'Hello world' },
          },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'res', description: 'Returns resource', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toContain('[resource]');
    expect(result).toContain('file:///hello.txt');
    expect(result).toContain('Hello world');
  });

  it('extracts embedded resource with blob fallback', async () => {
    const mockClient = createMockClient([
      {
        content: [
          {
            type: 'resource',
            resource: { uri: 'file:///data.bin', mimeType: 'application/octet-stream', blob: 'base64blobhere' },
          },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'blob', description: 'Returns blob', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toContain('[resource]');
    expect(result).toContain('base64 blob');
  });

  it('extracts resource_link content', async () => {
    const mockClient = createMockClient([
      {
        content: [
          { type: 'resource_link', uri: 'https://example.com/doc' },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'link', description: 'Returns link', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toContain('[resource_link]');
    expect(result).toContain('https://example.com/doc');
  });

  it('handles mixed content types', async () => {
    const mockClient = createMockClient([
      {
        content: [
          { type: 'text', text: 'Operation completed' },
          { type: 'image', data: 'imgdata', mimeType: 'image/png' },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'mixed', description: 'Mixed content', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toContain('Operation completed');
    expect(result).toContain('[image: image/png]');
  });

  it('handles error with non-text content', async () => {
    const mockClient = createMockClient([
      {
        isError: true,
        content: [
          { type: 'text', text: 'Error: something broke' },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'err', description: 'Errors', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    await expect(tool.execute({}, undefined)).rejects.toThrow(
      'MCP tool "err" error: Error: something broke',
    );
  });

  it('handles empty image data gracefully', async () => {
    const mockClient = createMockClient([
      {
        content: [
          { type: 'image', data: '', mimeType: 'image/png' },
        ],
      },
    ]);
    const tool = convertMcpTool(
      { name: 'empty_img', description: 'Empty image', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    expect(result).toContain('[image: image/png]');
    expect(result).toContain('0 chars');
  });

  it('skips image with missing mimeType', async () => {
    const mockClient = createMockClient([
      { content: [{ type: 'image', data: 'something' }] },
    ]);
    const tool = convertMcpTool(
      { name: 'bad_img', description: 'Bad image', inputSchema: { type: 'object', properties: {} } },
      mockClient,
    );
    const result = await tool.execute({}, undefined);
    // Falls back to "No output" since image requires mimeType
    expect(result).toBe('No output');
  });
});
