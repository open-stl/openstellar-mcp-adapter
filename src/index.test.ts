import { describe, it, expect, vi } from 'vitest';
import { tool } from '@opencode-ai/plugin';
import { jsonSchemaToZod } from './schema/json-schema-to-zod.js';
import { convertMcpTool } from './tool/convert-mcp-tool.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const zObj = tool.schema;

describe('jsonSchemaToZod', () => {
    it('converts string type', () => {
        const result = jsonSchemaToZod({ type: 'string' });
        expect(result.parse('hello')).toBe('hello');
        expect(() => result.parse(123)).toThrow();
    });

    it('converts string with enum values', () => {
        const result = jsonSchemaToZod({
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
        });
        expect(result.parse('active')).toBe('active');
        expect(() => result.parse('unknown')).toThrow();
    });

    it('converts number type', () => {
        const result = jsonSchemaToZod({ type: 'number' });
        expect(result.parse(42)).toBe(42);
        expect(result.parse(3.14)).toBe(3.14);
        expect(() => result.parse('foo')).toThrow();
    });

    it('converts integer type as number', () => {
        const result = jsonSchemaToZod({ type: 'integer' });
        expect(result.parse(42)).toBe(42);
        expect(() => result.parse('foo')).toThrow();
    });

    it('converts boolean type', () => {
        const result = jsonSchemaToZod({ type: 'boolean' });
        expect(result.parse(true)).toBe(true);
        expect(result.parse(false)).toBe(false);
        expect(() => result.parse('true')).toThrow();
    });

    it('converts array type with items', () => {
        const result = jsonSchemaToZod({
            type: 'array',
            items: { type: 'string' },
        });
        expect(result.parse(['a', 'b'])).toEqual(['a', 'b']);
        expect(() => result.parse([1, 2])).toThrow();
    });

    it('converts object type with required and optional properties', () => {
        const result = jsonSchemaToZod({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                email: { type: 'string' },
            },
            required: ['name'],
        });
        // name is required, age and email are optional
        expect(result.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
        expect(result.parse({ name: 'Bob', age: 30 })).toEqual({ name: 'Bob', age: 30 });
        expect(() => result.parse({})).toThrow(); // missing required name
    });

    it('handles anyOf by taking first branch', () => {
        const result = jsonSchemaToZod({
            anyOf: [{ type: 'number' }, { type: 'string' }],
        });
        // Takes first branch (number)
        expect(result.parse(42)).toBe(42);
        expect(() => result.parse('hello')).toThrow();
    });

    it('handles null-union type array ["string", "null"]', () => {
        const result = jsonSchemaToZod({
            type: ['string', 'null'],
        });
        // Should strip "null" and treat as string
        expect(result.parse('hello')).toBe('hello');
        expect(() => result.parse(123)).toThrow();
    });

    it('falls back to string for unknown/missing type', () => {
        const result = jsonSchemaToZod({});
        expect(result.parse('anything')).toBe('anything');
    });

    it('falls back to string for null/undefined input', () => {
        const result = jsonSchemaToZod(null);
        expect(result.parse('anything')).toBe('anything');
        const result2 = jsonSchemaToZod(undefined);
        expect(result2.parse('anything')).toBe('anything');
    });

    it('object schema is instanceof zObj.ZodObject (critical for convertMcpTool args extraction)', () => {
        const result = jsonSchemaToZod({
            type: 'object',
            properties: {
                query: { type: 'string' },
            },
            required: ['query'],
        });
        expect(result instanceof zObj.ZodObject).toBe(true);
        expect(result.shape).toBeDefined();
        expect(Object.keys(result.shape)).toContain('query');
    });

    it('multi-property object schema has all keys in shape', () => {
        const result = jsonSchemaToZod({
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'number' },
                verbose: { type: 'boolean' },
            },
            required: ['query'],
        });
        expect(result instanceof zObj.ZodObject).toBe(true);
        const keys = Object.keys(result.shape);
        expect(keys).toContain('query');
        expect(keys).toContain('limit');
        expect(keys).toContain('verbose');
    });

    it('non-object schemas do not pass instanceof ZodObject', () => {
        expect(jsonSchemaToZod({ type: 'string' }) instanceof zObj.ZodObject).toBe(false);
        expect(jsonSchemaToZod({ type: 'number' }) instanceof zObj.ZodObject).toBe(false);
    });
});

describe('convertMcpTool', () => {
    it('produces a tool with correct arg keys from object inputSchema', () => {
        const fakeClient = {} as any;
        const result = convertMcpTool(
            {
                name: 'test_tool',
                description: 'A test tool',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string' },
                        limit: { type: 'number' },
                    },
                    required: ['query'],
                },
            },
            fakeClient,
        );

        expect(result).toBeDefined();
        expect(result.args).toBeDefined();
        const argKeys = Object.keys(result.args);
        expect(argKeys).toContain('query');
        expect(argKeys).toContain('limit');
    });

    it('produces a tool with empty args when inputSchema is missing', () => {
        const fakeClient = {} as any;
        const result = convertMcpTool(
            { name: 'no_schema_tool' },
            fakeClient,
        );

        expect(result).toBeDefined();
        expect(result.args).toBeDefined();
    });

    it('produces a tool with empty args when inputSchema is non-object type', () => {
        const fakeClient = {} as any;
        const result = convertMcpTool(
            {
                name: 'string_schema_tool',
                inputSchema: { type: 'string' },
            },
            fakeClient,
        );

        expect(result).toBeDefined();
        expect(Object.keys(result.args)).toHaveLength(0);
    });
});
