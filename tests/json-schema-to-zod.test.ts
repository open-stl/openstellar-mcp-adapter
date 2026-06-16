import { describe, expect, it, vi } from 'vitest';
import { jsonSchemaToZod } from '../src/schema/json-schema-to-zod.js';

// jsonSchemaToZod returns zod schemas from @opencode-ai/plugin's tool.schema (= z from zod)
// Validate via .parse() / .safeParse() rather than internal _def to be zod-version-agnostic

describe('jsonSchemaToZod - basic types', () => {
  it('converts string type', () => {
    const result = jsonSchemaToZod({ type: 'string' });
    expect(result.parse('hello')).toBe('hello');
    // Should reject non-string
    expect(result.safeParse(42).success).toBe(false);
  });

  it('converts number type', () => {
    const result = jsonSchemaToZod({ type: 'number' });
    expect(result.parse(42)).toBe(42);
    expect(result.safeParse('hello').success).toBe(false);
  });

  it('converts integer type', () => {
    const result = jsonSchemaToZod({ type: 'integer' });
    expect(result.parse(42)).toBe(42);
    expect(result.safeParse('hello').success).toBe(false);
  });

  it('converts boolean type', () => {
    const result = jsonSchemaToZod({ type: 'boolean' });
    expect(result.parse(true)).toBe(true);
    expect(result.safeParse('hello').success).toBe(false);
  });

  it('converts string with default value', () => {
    const result = jsonSchemaToZod({ type: 'string', default: 'hello' });
    expect(result.parse('world')).toBe('world');
  });

  it('converts string with enum values', () => {
    const result = jsonSchemaToZod({ type: 'string', enum: ['a', 'b', 'c'] });
    expect(result.parse('a')).toBe('a');
    expect(result.safeParse('d').success).toBe(false);
  });
});

describe('jsonSchemaToZod - type arrays', () => {
  it('handles ["string", "null"] as nullable string', () => {
    const result = jsonSchemaToZod({ type: ['string', 'null'] });
    expect(result.parse('hello')).toBe('hello');
    expect(result.parse(null)).toBeNull();
    expect(result.safeParse(42).success).toBe(false);
  });

  it('strips null from type array and takes first real type', () => {
    const result = jsonSchemaToZod({ type: ['number', 'null'] });
    expect(result.parse(42)).toBe(42);
    expect(result.parse(null)).toBeNull();
    expect(result.safeParse('hello').success).toBe(false);
  });

  it('defaults to string when all types are null', () => {
    const result = jsonSchemaToZod({ type: ['null'] });
    // Falls back to string when everything is null
    expect(result.parse('hello')).toBe('hello');
  });

  it('handles ["string", "number", "null"] as union + nullable', () => {
    const result = jsonSchemaToZod({ type: ['string', 'number', 'null'] });
    expect(result.parse('hello')).toBe('hello');
    expect(result.parse(42)).toBe(42);
    expect(result.parse(null)).toBeNull();
    expect(result.safeParse(true).success).toBe(false);
  });

  it('handles ["string", "number", "boolean"] as union (3+ non-null types)', () => {
    const result = jsonSchemaToZod({ type: ['string', 'number', 'boolean'] });
    expect(result.parse('hello')).toBe('hello');
    expect(result.parse(42)).toBe(42);
    expect(result.parse(true)).toBe(true);
    expect(result.safeParse(null).success).toBe(false);
  });
});

describe('jsonSchemaToZod - anyOf (FIXED - GREEN state)', () => {
  it('anyOf should accept all branches', () => {
    const result = jsonSchemaToZod({ anyOf: [{ type: 'string' }, { type: 'number' }] });
    // Accepts both string and number via z.union
    expect(result.safeParse(42).success).toBe(true);
  });

  it('anyOf with nullable should accept null', () => {
    const result = jsonSchemaToZod({ anyOf: [{ type: 'string' }, { type: 'null' }] });
    expect(result.safeParse(null).success).toBe(true);
  });

  it('anyOf with objects should accept all object shapes', () => {
    const result = jsonSchemaToZod({
      anyOf: [
        { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      ],
    });
    expect(result.safeParse({ id: 1 }).success).toBe(true);
  });

  it('anyOf with single branch unwraps without union', () => {
    const result = jsonSchemaToZod({ anyOf: [{ type: 'string' }] });
    // Single branch should be unwrapped (not wrapped in z.union with 1 element)
    expect(result.parse('hello')).toBe('hello');
    expect(result.safeParse(42).success).toBe(false);
  });

  it('empty anyOf falls through to type handling', () => {
    const result = jsonSchemaToZod({ anyOf: [] });
    // Empty anyOf should not crash — falls through to createFromType
    expect(() => result.parse('fallback')).not.toThrow();
  });
});

describe('jsonSchemaToZod - oneOf (FIXED - GREEN state)', () => {
  it('oneOf should accept all branches', () => {
    const result = jsonSchemaToZod({ oneOf: [{ type: 'string' }, { type: 'boolean' }] });
    expect(result.safeParse(true).success).toBe(true);
  });

  it('oneOf with single branch unwraps without union', () => {
    const result = jsonSchemaToZod({ oneOf: [{ type: 'number' }] });
    expect(result.parse(42)).toBe(42);
  });

  it('empty oneOf falls through gracefully', () => {
    const result = jsonSchemaToZod({ oneOf: [] });
    expect(() => result.parse('fallback')).not.toThrow();
  });
});

describe('jsonSchemaToZod - allOf (FIXED - GREEN state)', () => {
  it('allOf should merge properties', () => {
    const result = jsonSchemaToZod({
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        { type: 'object', properties: { b: { type: 'number' } } },
      ],
    });
    expect(result.safeParse({ a: 'hello', b: 42 }).success).toBe(true);
  });

  it('allOf merges required fields from all branches', () => {
    const result = jsonSchemaToZod({
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
      ],
    });
    // Both a and b are required
    expect(result.safeParse({ a: 'hello' }).success).toBe(false);
    expect(result.safeParse({ a: 'hello', b: 42 }).success).toBe(true);
  });

  it('allOf deduplicates duplicate required fields', () => {
    const result = jsonSchemaToZod({
      allOf: [
        { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } }, required: ['a'] },
        { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } }, required: ['a', 'b'] },
      ],
    });
    // 'a' appears in both required arrays but should be deduped
    expect(result.safeParse({ a: 'hello', b: 42 }).success).toBe(true);
  });

  it('empty allOf falls through to fallback schema', () => {
    // empty allOf: length not >0, falls through to createFromType(undefined) → z.string fallback
    expect(() => jsonSchemaToZod({ allOf: [] })).not.toThrow();
    const result = jsonSchemaToZod({ allOf: [] });
    expect(result.parse('fallback')).toBe('fallback');
  });
});

describe('jsonSchemaToZod - empty enum', () => {
  it('does not crash on empty enum array', () => {
    expect(() => jsonSchemaToZod({ type: 'string', enum: [] })).not.toThrow();
  });
});

describe('jsonSchemaToZod - $ref handling', () => {
  it('does not crash on $ref schema', () => {
    // $ref is currently not resolved — should skip gracefully
    expect(() => jsonSchemaToZod({ $ref: '#/definitions/Foo' })).not.toThrow();
  });

  it('logs $ref fallback to console.debug (not warn)', () => {
    // $ref fallback to z.string() is a normal recovery path, not a warning-worthy
    // condition. It should be silent in production logs unless the user opts in to
    // debug logging. We verify the function does NOT call console.warn.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    jsonSchemaToZod({ $ref: '#/definitions/Foo' });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('jsonSchemaToZod - objects', () => {
  it('converts object with required fields', () => {
    const result = jsonSchemaToZod({
      type: 'object',
      properties: { name: { type: 'string' }, age: { type: 'number' } },
      required: ['name'],
    });
    expect(result.parse({ name: 'hello', age: 25 })).toEqual({ name: 'hello', age: 25 });
  });

  it('converts object without properties', () => {
    const result = jsonSchemaToZod({ type: 'object' });
    expect(result.parse({})).toEqual({});
  });

  it('converts object with all optional fields', () => {
    const result = jsonSchemaToZod({
      type: 'object',
      properties: { a: { type: 'string' } },
      required: [],
    });
    expect(result.parse({})).toEqual({});
    expect(result.parse({ a: 'hello' })).toEqual({ a: 'hello' });
  });

  it('converts nested objects', () => {
    const result = jsonSchemaToZod({
      type: 'object',
      properties: {
        filters: {
          type: 'object',
          properties: { status: { type: 'string' }, limit: { type: 'number' } },
          required: ['status'],
        },
      },
      required: ['filters'],
    });
    const parsed = result.parse({ filters: { status: 'active', limit: 10 } });
    expect(parsed.filters.status).toBe('active');
    expect(parsed.filters.limit).toBe(10);
  });
});

describe('jsonSchemaToZod - arrays', () => {
  it('converts array of strings', () => {
    const result = jsonSchemaToZod({ type: 'array', items: { type: 'string' } });
    expect(result.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(result.safeParse('not-array').success).toBe(false);
  });

  it('converts array of objects', () => {
    const result = jsonSchemaToZod({
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'number' } } },
    });
    expect(result.parse([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('handles array without items (defaults to object-string)', () => {
    const result = jsonSchemaToZod({ type: 'array' });
    // Should produce an array schema (items fallback to z.string())
    expect(result.parse([])).toEqual([]);
  });
});

describe('jsonSchemaToZod - edge cases', () => {
  it('returns string for null input', () => {
    const result = jsonSchemaToZod(null);
    expect(result.parse('hello')).toBe('hello');
  });

  it('returns string for undefined input', () => {
    const result = jsonSchemaToZod(undefined);
    expect(result.parse('hello')).toBe('hello');
  });

  it('returns string for non-object input', () => {
    const result = jsonSchemaToZod('string');
    expect(result.parse('hello')).toBe('hello');
  });

  it('handles schema with only description', () => {
    const result = jsonSchemaToZod({ description: 'Some unknown type' });
    expect(result.parse('hello')).toBe('hello');
  });

  it('handles schema with type and description', () => {
    const result = jsonSchemaToZod({ type: 'string', description: 'A string field' });
    expect(result.parse('hello')).toBe('hello');
  });
});
