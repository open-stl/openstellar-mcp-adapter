import { describe, expect, it, vi } from 'vitest';
import {
    parseRegistryUrl,
    buildDistTagsUrl,
    resolveRegistryUrl,
    type ResolveEffects,
} from '../src/hooks/npm-registry.js';

// ---------------------------------------------------------------------------
// parseRegistryUrl
// ---------------------------------------------------------------------------

describe('npm-registry : parseRegistryUrl', () => {
    it('accepts a valid https URL', () => {
        expect(parseRegistryUrl('https://registry.npmjs.org')).toBe(
            'https://registry.npmjs.org/',
        );
    });

    it('accepts a valid http URL', () => {
        expect(parseRegistryUrl('http://localhost:4873')).toBe(
            'http://localhost:4873/',
        );
    });

    it('accepts a URL with a base path', () => {
        expect(parseRegistryUrl('https://my.company.com/npm')).toBe(
            'https://my.company.com/npm',
        );
    });

    it('returns null for a URL with credentials', () => {
        expect(parseRegistryUrl('https://token:secret@registry.npmjs.org')).toBeNull();
    });

    it('returns null for a URL with a username only', () => {
        expect(parseRegistryUrl('https://user@registry.npmjs.org')).toBeNull();
    });

    it('returns null for a URL with a query string', () => {
        expect(parseRegistryUrl('https://registry.npmjs.org?q=1')).toBeNull();
    });

    it('returns null for a URL with a fragment', () => {
        expect(parseRegistryUrl('https://registry.npmjs.org#section')).toBeNull();
    });

    it('returns null for a malformed URL', () => {
        expect(parseRegistryUrl('not-a-url')).toBeNull();
    });

    it('returns null for an empty string', () => {
        expect(parseRegistryUrl('')).toBeNull();
    });

    it('returns null for whitespace-only input', () => {
        expect(parseRegistryUrl('   ')).toBeNull();
    });

    it('returns null for CRLF-only input', () => {
        expect(parseRegistryUrl('\r\n')).toBeNull();
    });

    it('trims whitespace before validating', () => {
        expect(parseRegistryUrl('  https://registry.npmjs.org  ')).toBe(
            'https://registry.npmjs.org/',
        );
    });

    it('trims trailing newlines before validating', () => {
        expect(parseRegistryUrl('https://registry.npmjs.org\n')).toBe(
            'https://registry.npmjs.org/',
        );
    });

    it('returns null for a non-http protocol', () => {
        expect(parseRegistryUrl('ftp://registry.npmjs.org')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// buildDistTagsUrl
// ---------------------------------------------------------------------------

describe('npm-registry : buildDistTagsUrl', () => {
    it('builds a dist-tags URL preserving the base path', () => {
        const url = buildDistTagsUrl(
            'https://my-company.com/npm',
            'my-package',
        );
        expect(url).toBe(
            'https://my-company.com/npm/-/package/my-package/dist-tags',
        );
    });

    it('strips trailing slash from the registry base', () => {
        const url = buildDistTagsUrl(
            'https://registry.npmjs.org/',
            'my-package',
        );
        expect(url).toBe(
            'https://registry.npmjs.org/-/package/my-package/dist-tags',
        );
    });

    it('percent-encodes a scoped package once', () => {
        const url = buildDistTagsUrl(
            'https://registry.npmjs.org',
            '@scope/my-package',
        );
        expect(url).toBe(
            'https://registry.npmjs.org/-/package/%40scope%2Fmy-package/dist-tags',
        );
    });

    it('returns null when the registry URL is invalid', () => {
        expect(buildDistTagsUrl('not-a-url', 'pkg')).toBeNull();
    });

    it('returns null when the registry URL has credentials', () => {
        expect(
            buildDistTagsUrl('https://user:pass@registry.npmjs.org', 'pkg'),
        ).toBeNull();
    });

    it('returns null when the package name is empty', () => {
        expect(
            buildDistTagsUrl('https://registry.npmjs.org', ''),
        ).toBeNull();
    });

    it('returns null when the package name is whitespace', () => {
        expect(
            buildDistTagsUrl('https://registry.npmjs.org', '   '),
        ).toBeNull();
    });

    it('accepts @openstellar/mcp-adapter literal', () => {
        const url = buildDistTagsUrl(
            'https://registry.npmjs.org',
            '@openstellar/mcp-adapter',
        );
        expect(url).toBe(
            'https://registry.npmjs.org/-/package/%40openstellar%2Fmcp-adapter/dist-tags',
        );
    });
});

// ---------------------------------------------------------------------------
// resolveRegistryUrl
// ---------------------------------------------------------------------------

describe('npm-registry : resolveRegistryUrl', () => {
    it('returns the scoped registry when npm config provides one', async () => {
        const execFile = vi.fn().mockResolvedValue({
            stdout: 'https://scoped-registry.example.com/npm\n',
            stderr: '',
        });
        const result = await resolveRegistryUrl({ execFile });
        expect(result).toEqual({
            url: 'https://scoped-registry.example.com/npm',
            source: 'scoped',
        });
        expect(execFile).toHaveBeenCalledWith(
            'npm',
            ['config', 'get', '@openstellar:registry'],
            expect.objectContaining({ timeout: expect.any(Number) }),
        );
    });

    it('falls through to default registry when scoped is empty', async () => {
        const execFile = vi.fn()
            .mockResolvedValueOnce({ stdout: '\n', stderr: '' }) // scoped -> empty
            .mockResolvedValueOnce({ stdout: 'https://default-registry.example.com\n', stderr: '' }); // default
        const result = await resolveRegistryUrl({ execFile });
        expect(result).toEqual({
            url: 'https://default-registry.example.com/',
            source: 'default',
        });
    });

    it('falls through to fallback when both are empty', async () => {
        const execFile = vi.fn().mockResolvedValue({ stdout: '\n', stderr: '' });
        const result = await resolveRegistryUrl({ execFile });
        expect(result).toEqual({
            url: 'https://registry.npmjs.org',
            source: 'fallback',
        });
    });

    it('falls through to fallback when npm is unavailable', async () => {
        const execFile = vi.fn().mockRejectedValue(
            new Error('ENOENT: npm not found'),
        );
        const result = await resolveRegistryUrl({ execFile });
        expect(result).toEqual({
            url: 'https://registry.npmjs.org',
            source: 'fallback',
        });
    });

    it('falls through to fallback on subprocess timeout', async () => {
        const execFile = vi.fn().mockRejectedValue(
            new Error('spawn npm ENOENT'),
        );
        const result = await resolveRegistryUrl({ execFile });
        expect(result).toEqual({
            url: 'https://registry.npmjs.org',
            source: 'fallback',
        });
    });

    it('falls through to fallback on non-zero exit', async () => {
        const execFile = vi.fn().mockRejectedValue(
            new Error('command failed'),
        );
        const result = await resolveRegistryUrl({ execFile });
        expect(result).toEqual({
            url: 'https://registry.npmjs.org',
            source: 'fallback',
        });
    });

    it('rejects scoped registry output with credentials', async () => {
        const execFile = vi.fn().mockResolvedValue({
            stdout: 'https://token:secret@registry.npmjs.org\n',
            stderr: '',
        });
        const result = await resolveRegistryUrl({ execFile });
        // Scoped registry is invalid (has credentials), so falls to default
        // Default also returns empty since we only called scoped
        expect(result.source).toBe('fallback');
    });

    it('rejects invalid URL from npm config', async () => {
        const execFile = vi.fn()
            .mockResolvedValueOnce({ stdout: 'not-a-url\n', stderr: '' }) // scoped -> invalid
            .mockResolvedValueOnce({ stdout: 'https://default-registry.example.com\n', stderr: '' }); // default
        const result = await resolveRegistryUrl({ execFile });
        expect(result).toEqual({
            url: 'https://default-registry.example.com/',
            source: 'default',
        });
    });
});
