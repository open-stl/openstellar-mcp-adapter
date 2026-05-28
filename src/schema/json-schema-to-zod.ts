import { tool } from '@opencode-ai/plugin';

const zObj = tool.schema;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonSchemaToZod(schema: unknown): any {
    if (!schema || typeof schema !== 'object') {
        return zObj.string();
    }

    // Clone to avoid mutation
    const s = { ...(schema as Record<string, unknown>) };

    // Handle type arrays like ["string", "null"] — strip "null", take first real type
    if (Array.isArray(s.type)) {
        s.type = s.type.filter(t => t !== 'null')[0] || 'string';
    }

    // Handle union types — take the first branch (pragmatic simplification)
    if (s.anyOf && Array.isArray(s.anyOf) && s.anyOf.length > 0) {
        return jsonSchemaToZod(s.anyOf[0]);
    }
    if (s.oneOf && Array.isArray(s.oneOf) && s.oneOf.length > 0) {
        return jsonSchemaToZod(s.oneOf[0]);
    }
    if (s.allOf && Array.isArray(s.allOf) && s.allOf.length > 0) {
        return jsonSchemaToZod(s.allOf[0]);
    }

    if (s.type === 'string') {
        const enumValues = s.enum;
        if (Array.isArray(enumValues) && enumValues.every((v): v is string => typeof v === 'string')) {
            return zObj.enum(enumValues as [string, ...string[]]);
        }
        return zObj.string();
    }

    if (s.type === 'number' || s.type === 'integer') {
        return zObj.number();
    }

    if (s.type === 'boolean') {
        return zObj.boolean();
    }

    if (s.type === 'array') {
        return zObj.array(jsonSchemaToZod(s.items));
    }

    if (s.type === 'object' || s.properties) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shape: Record<string, any> = {};
        const required = new Set((s.required as string[] | undefined) || []);
        const properties = (s.properties as Record<string, unknown> | undefined) || {};

        for (const [key, prop] of Object.entries(properties)) {
            let zodType = jsonSchemaToZod(prop);
            if (!required.has(key)) {
                zodType = zodType.optional();
            }
            shape[key] = zodType;
        }

        return zObj.object(shape);
    }

    return zObj.string().describe(s.description ? String(s.description) : 'Unknown type fallback');
}
