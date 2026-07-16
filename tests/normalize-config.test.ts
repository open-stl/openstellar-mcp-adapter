import { describe, expect, it } from 'vitest';
import { normalizeServerConfig } from '../src/utils/normalize-config.js';

describe('normalizeServerConfig', () => {
    it('returns an empty array if options are undefined', () => {
        expect(normalizeServerConfig(undefined)).toEqual([]);
    });

    it('returns an empty array if mcp is not an object', () => {
        expect(normalizeServerConfig({ mcp: null as any })).toEqual([]);
        expect(normalizeServerConfig({ mcp: [] as any })).toEqual([]);
    });

    it('converts mcp record to an array of BaseServerConfig, injecting names', () => {
        const config = {
            mcp: {
                serverA: { command: 'echo', args: ['A'] },
                serverB: { command: 'echo', args: ['B'] }
            }
        };
        const result = normalizeServerConfig(config);
        expect(result).toEqual([
            { name: 'serverA', command: 'echo', args: ['A'] },
            { name: 'serverB', command: 'echo', args: ['B'] }
        ]);
    });

    it('preserves the local stderr opt-in during normalization', () => {
        const result = normalizeServerConfig({
            mcp: {
                local: { type: 'local', command: ['node', 'server.js'], stderr: 'inherit' },
            },
        });

        expect(result).toEqual([
            { name: 'local', type: 'local', command: ['node', 'server.js'], stderr: 'inherit' },
        ]);
    });

    it('filters out explicitly disabled servers (enabled: false)', () => {
        const config = {
            mcp: {
                serverA: { command: 'echo', enabled: false },
                serverB: { command: 'echo', enabled: true },
                serverC: { command: 'echo' } // implicitly enabled
            }
        };
        const result = normalizeServerConfig(config);
        // serverA should be excluded.
        // serverB and serverC should be included.
        // Additionally, 'enabled' property should be stripped.
        expect(result).toEqual([
            { name: 'serverB', command: 'echo' },
            { name: 'serverC', command: 'echo' }
        ]);
    });

    it('skips invalid (non-object) server entries', () => {
        const config = {
            mcp: {
                serverA: { command: 'echo' },
                serverB: 'invalid-string',
                serverC: null
            }
        };
        const result = normalizeServerConfig(config as any);
        expect(result).toEqual([
            { name: 'serverA', command: 'echo' }
        ]);
    });
});
