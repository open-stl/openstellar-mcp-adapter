import type { BaseServerConfig } from '../types/config.js';
import type { Transport } from './transport-factory.js';

export interface CacheEntry {
    promise: Promise<Record<string, unknown>>;
    transports: Transport[];
}

function stableStringify(obj: unknown): string {
    if (obj === null || obj === undefined) return String(obj);
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
    
    const sorted = Object.keys(obj as Record<string, unknown>)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stableStringify((obj as Record<string, unknown>)[key])}`)
        .join(',');
    return `{${sorted}}`;
}

function serializeServerConfig(server: BaseServerConfig): string {
    const serverRecord = server as unknown as Record<string, unknown>;
    const { name, type, timeout, ...rest } = serverRecord;
    return stableStringify({
        name,
        type,
        timeout: timeout ?? null,
        ...rest,
    });
}

export class AdapterCache {
    private cache = new Map<string, CacheEntry>();

    getCacheKey(servers: BaseServerConfig[]): string {
        const sorted = [...servers].sort((a, b) => a.name.localeCompare(b.name));
        return `[${sorted.map(serializeServerConfig).join(',')}]`;
    }

    get(key: string): CacheEntry | undefined {
        return this.cache.get(key);
    }

    set(key: string, entry: CacheEntry): void {
        this.cache.set(key, entry);
    }

    async delete(key: string): Promise<void> {
        const entry = this.cache.get(key);
        if (entry) {
            await this.closeTransports(entry.transports);
            this.cache.delete(key);
        }
    }

    clear(): void {
        this.cache.clear();
    }

    async closeAllTransports(): Promise<void> {
        const allTransports: Transport[] = [];
        for (const entry of this.cache.values()) {
            allTransports.push(...entry.transports);
        }
        await this.closeTransports(allTransports);
    }

    private async closeTransports(transports: Transport[]): Promise<void> {
        await Promise.all(
            transports.map(async (transport) => {
                try {
                    await Promise.resolve(transport.close());
                } catch {
                    // best-effort cleanup
                }
            })
        );
    }
}

export const globalAdapterCache = new AdapterCache();
