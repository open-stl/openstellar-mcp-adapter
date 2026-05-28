import { tool } from '@opencode-ai/plugin';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { jsonSchemaToZod } from '../schema/json-schema-to-zod.js';
import { log } from '../utils/logger.js';

const zObj = tool.schema;

export interface McpToolDefinition {
    name: string;
    description?: string;
    inputSchema?: unknown;
}

export function convertMcpTool(
    mcpTool: McpToolDefinition,
    client: Client,
): ReturnType<typeof tool> {
    log(`Converting MCP tool: ${mcpTool.name}`);

    const zodSchema = mcpTool.inputSchema
        ? jsonSchemaToZod(mcpTool.inputSchema)
        : zObj.object({});

    return tool({
        description: mcpTool.description ?? '',
        args: zodSchema instanceof zObj.ZodObject ? zodSchema.shape : {},
        async execute(args: Record<string, unknown>, _context: unknown) {
            log(`Executing tool: ${mcpTool.name}`);

            const result = await client.callTool(
                { name: mcpTool.name, arguments: args },
                CallToolResultSchema,
            );

            if (result.isError) {
                const errorParts: string[] = [];
                if (result.content && Array.isArray(result.content)) {
                    for (const content of result.content) {
                        if (content && typeof content === 'object' && 'text' in content) {
                            errorParts.push(String((content as { text: unknown }).text));
                        }
                    }
                }
                const errorMsg = errorParts.join('\n') || 'Unknown MCP tool error';
                throw new Error(`MCP tool "${mcpTool.name}" error: ${errorMsg}`);
            }

            const textParts: string[] = [];
            if (result.content && Array.isArray(result.content)) {
                for (const content of result.content) {
                    if (
                        content &&
                        typeof content === 'object' &&
                        'type' in content &&
                        'text' in content
                    ) {
                        if (content.type === 'text') {
                            textParts.push(String((content as { text: unknown }).text));
                        }
                    }
                }
            }

            if (textParts.length === 0 && result.structuredContent) {
                return JSON.stringify(result.structuredContent, null, 2);
            }

            return textParts.join('\n\n') || 'No output';
        },
    });
}
