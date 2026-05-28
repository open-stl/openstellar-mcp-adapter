export async function closeTransport(transport: { close(): void | Promise<void> }) {
    try {
        await Promise.resolve(transport.close());
    } catch {
        // best-effort cleanup
    }
}
