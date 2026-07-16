import { log } from '../utils/logger.js';
import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { env } from 'node:process';
import { resolveRegistryUrl, buildDistTagsUrl, type ResolveEffects } from './npm-registry.js';

const PACKAGE_NAME = '@openstellar/mcp-adapter';
const NPM_FETCH_TIMEOUT = 5000;

const execFileAsync = promisify(nodeExecFile);

const resolveEffects: ResolveEffects = {
    execFile: async (cmd, args, opts) => {
        const { stdout } = await execFileAsync(cmd, args, opts);
        return { stdout, stderr: '' };
    },
};

declare const PACKAGE_VERSION: string;

export interface UpdateCheckResult {
    needsUpdate: boolean;
    currentVersion: string | null;
    latestVersion: string | null;
    error?: string;
}

export interface AutoUpdateDeps {
    readCurrentVersion: () => string | null;
    fetchLatestVersion: () => Promise<string | null>;
    invalidateCache: () => boolean;
}

export function getCurrentVersion(): string | null {
    if (typeof PACKAGE_VERSION !== 'undefined' && PACKAGE_VERSION) {
        return PACKAGE_VERSION;
    }

    try {
        const __filename = fileURLToPath(import.meta.url);
        const dir = dirname(__filename);
        const candidates = [
            join(dir, '..', 'package.json'),
            join(dir, '..', '..', 'package.json'),
        ];
        for (const candidate of candidates) {
            if (existsSync(candidate)) {
                const pkg = JSON.parse(readFileSync(candidate, 'utf-8'));
                if (pkg.version) return pkg.version;
            }
        }
    } catch {
    }

    return null;
}

export async function getLatestVersion(): Promise<string | null> {
    const { url: registryUrl } = await resolveRegistryUrl(resolveEffects);
    const distTagsUrl = buildDistTagsUrl(registryUrl, PACKAGE_NAME);
    if (!distTagsUrl) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NPM_FETCH_TIMEOUT);

    try {
        const response = await fetch(distTagsUrl, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) return null;

        const data = (await response.json()) as Record<string, string>;
        return data.latest ?? null;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`[auto-update] Failed to fetch latest version: ${msg}`);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

function getPossibleCacheRoots(): string[] {
    const cacheDirs = [
        join(homedir(), '.cache', 'opencode', 'packages'),
        join(homedir(), '.config', 'opencode', 'packages'),
    ];

    if (platform() === 'win32' && env.APPDATA) {
        cacheDirs.push(join(env.APPDATA, 'opencode', 'packages'));
    }

    return cacheDirs;
}

export function invalidatePackageCache(): boolean {
    const cacheRoots = getPossibleCacheRoots();
    const seen = new Set<string>();
    let removed = false;

    for (const root of cacheRoots) {
        if (seen.has(root)) continue;
        seen.add(root);
        if (!existsSync(root)) continue;

        const packageDir = join(root, PACKAGE_NAME);
        if (existsSync(packageDir)) {
            try {
                rmSync(packageDir, { recursive: true, force: true });
                log(`[auto-update] Removed cache package dir: ${packageDir}`);
                removed = true;
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                log(`[auto-update] Failed to remove ${packageDir}: ${msg}`);
            }
        }

        const specDir = join(root, `${PACKAGE_NAME}@latest`);
        if (existsSync(specDir)) {
            try {
                rmSync(specDir, { recursive: true, force: true });
                log(`[auto-update] Removed cache spec dir: ${specDir}`);
                removed = true;
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                log(`[auto-update] Failed to remove ${specDir}: ${msg}`);
            }
        }
    }

    return removed;
}

export function isNewerVersion(latest: string, current: string): boolean {
    // Compares stable version parts only (major.minor.patch); prerelease tags are ignored.
    const parse = (v: string) => v.replace(/^v/, '').split(/[-+]/)[0].split('.').map(Number);
    const [a, b] = [parse(latest), parse(current)];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
        if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
    }
    return false;
}

export async function checkForUpdate(
    deps: AutoUpdateDeps = {
        readCurrentVersion: getCurrentVersion,
        fetchLatestVersion: getLatestVersion,
        invalidateCache: invalidatePackageCache,
    },
): Promise<UpdateCheckResult> {
    const currentVersion = deps.readCurrentVersion();
    if (!currentVersion) {
        return {
            needsUpdate: false,
            currentVersion: null,
            latestVersion: null,
            error: 'Could not determine current version',
        };
    }

    const latestVersion = await deps.fetchLatestVersion();
    if (!latestVersion) {
        return {
            needsUpdate: false,
            currentVersion,
            latestVersion: null,
            error: 'Could not fetch latest version from npm',
        };
    }

    if (!isNewerVersion(latestVersion, currentVersion)) {
        log(`[auto-update] Already up-to-date: ${currentVersion}`);
        return { needsUpdate: false, currentVersion, latestVersion };
    }

    log(`[auto-update] Update available: ${currentVersion} -> ${latestVersion}`);
    deps.invalidateCache();

    return { needsUpdate: true, currentVersion, latestVersion };
}

export function formatUpdateMessage(result: UpdateCheckResult): {
    title: string;
    message: string;
    variant: 'info' | 'success' | 'warning';
} {
    if (!result.needsUpdate || !result.latestVersion) {
        return { title: 'MCP Adapter', message: 'Up-to-date', variant: 'info' };
    }
    return {
        title: 'MCP Adapter Update',
        message: `v${result.currentVersion} -> v${result.latestVersion}. Restart OpenCode to apply.`,
        variant: 'warning',
    };
}
