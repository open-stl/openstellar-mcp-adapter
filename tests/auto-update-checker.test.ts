import { describe, expect, it, vi } from 'vitest';
import {
    checkForUpdate,
    formatUpdateMessage,
    isNewerVersion,
    type AutoUpdateDeps,
    type UpdateCheckResult,
} from '../src/hooks/auto-update-checker.js';

describe('checkForUpdate', () => {
    const makeDeps = (overrides: Partial<AutoUpdateDeps> = {}): AutoUpdateDeps => ({
        readCurrentVersion: () => '1.0.0',
        fetchLatestVersion: async () => '1.0.0',
        invalidateCache: () => true,
        ...overrides,
    });

    it('returns needsUpdate=false when versions match', async () => {
        const result = await checkForUpdate(makeDeps());
        expect(result.needsUpdate).toBe(false);
        expect(result.currentVersion).toBe('1.0.0');
        expect(result.latestVersion).toBe('1.0.0');
        expect(result.error).toBeUndefined();
    });

    it('returns needsUpdate=true when latest is newer', async () => {
        const deps = makeDeps({
            readCurrentVersion: () => '1.0.0',
            fetchLatestVersion: async () => '2.0.0',
        });
        const result = await checkForUpdate(deps);
        expect(result.needsUpdate).toBe(true);
        expect(result.currentVersion).toBe('1.0.0');
        expect(result.latestVersion).toBe('2.0.0');
    });

    it('calls invalidateCache when newer version detected', async () => {
        const invalidate = vi.fn(() => true);
        const deps = makeDeps({
            readCurrentVersion: () => '1.0.0',
            fetchLatestVersion: async () => '2.0.0',
            invalidateCache: invalidate,
        });
        await checkForUpdate(deps);
        expect(invalidate).toHaveBeenCalledOnce();
    });

    it('does not call invalidateCache when versions match', async () => {
        const invalidate = vi.fn(() => true);
        const deps = makeDeps({ invalidateCache: invalidate });
        await checkForUpdate(deps);
        expect(invalidate).not.toHaveBeenCalled();
    });

    it('does not call invalidateCache when current version unknown', async () => {
        const invalidate = vi.fn(() => true);
        const deps = makeDeps({
            readCurrentVersion: () => null,
            invalidateCache: invalidate,
        });
        const result = await checkForUpdate(deps);
        expect(invalidate).not.toHaveBeenCalled();
        expect(result.error).toContain('Could not determine current version');
    });

    it('returns error when latest version fetch fails', async () => {
        const invalidate = vi.fn(() => true);
        const deps = makeDeps({
            fetchLatestVersion: async () => null,
            invalidateCache: invalidate,
        });
        const result = await checkForUpdate(deps);
        expect(invalidate).not.toHaveBeenCalled();
        expect(result.error).toContain('Could not fetch latest version');
    });

    it('handles pre-release versions as equal to their stable base', async () => {
        // With a stable-only comparator, 1.0.0-alpha.1 and 1.0.0 have the same
        // stable parts so no update is triggered. Use a higher stable version to
        // test update detection with pre-release inputs.
        const deps = makeDeps({
            readCurrentVersion: () => '1.0.0-alpha.1',
            fetchLatestVersion: async () => '2.0.0',
        });
        const result = await checkForUpdate(deps);
        expect(result.needsUpdate).toBe(true);
    });

    it('returns needsUpdate=false when same pre-release version', async () => {
        const deps = makeDeps({
            readCurrentVersion: () => '1.0.0-beta.1',
            fetchLatestVersion: async () => '1.0.0-beta.1',
        });
        const result = await checkForUpdate(deps);
        expect(result.needsUpdate).toBe(false);
    });
});

describe('formatUpdateMessage', () => {
    it('returns warning variant when update is needed', () => {
        const result: UpdateCheckResult = {
            needsUpdate: true,
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
        };
        const msg = formatUpdateMessage(result);
        expect(msg.variant).toBe('warning');
        expect(msg.title).toContain('Update');
        expect(msg.message).toContain('1.0.0');
        expect(msg.message).toContain('2.0.0');
        expect(msg.message).toContain('Restart');
    });

    it('returns info variant when no update needed', () => {
        const result: UpdateCheckResult = {
            needsUpdate: false,
            currentVersion: '1.0.0',
            latestVersion: '1.0.0',
        };
        const msg = formatUpdateMessage(result);
        expect(msg.variant).toBe('info');
        expect(msg.message).toBe('Up-to-date');
    });

    it('returns info variant when latest version unknown', () => {
        const result: UpdateCheckResult = {
            needsUpdate: false,
            currentVersion: '1.0.0',
            latestVersion: null,
            error: 'Could not fetch latest version',
        };
        const msg = formatUpdateMessage(result);
        expect(msg.variant).toBe('info');
    });
});

describe('isNewerVersion', () => {
    it('returns false when versions are equal', () => {
        expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
        expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
        // prerelease tags are ignored; only stable parts are compared
        expect(isNewerVersion('1.0.0-alpha.1', '1.0.0-beta.1')).toBe(false);
    });

    it('returns true when latest is newer', () => {
        expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
        expect(isNewerVersion('1.1.0', '1.0.1')).toBe(true);
        expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
    });

    it('returns false when downgrading (latest is older)', () => {
        expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
        expect(isNewerVersion('1.0.1', '1.1.0')).toBe(false);
        expect(isNewerVersion('1.9.9', '2.0.0')).toBe(false);
    });

    it('ignores prerelease tags and compares stable parts only', () => {
        expect(isNewerVersion('1.0.0-alpha.1', '1.0.0')).toBe(false);
        expect(isNewerVersion('1.0.0', '1.0.0-alpha.1')).toBe(false);
        expect(isNewerVersion('2.0.0-beta.1', '1.0.0')).toBe(true);
        expect(isNewerVersion('1.0.0-beta.1', '2.0.0')).toBe(false);
    });

    it('strips build metadata', () => {
        expect(isNewerVersion('1.0.1+build.123', '1.0.0')).toBe(true);
        expect(isNewerVersion('1.0.0+build.123', '1.0.0')).toBe(false);
    });
});
