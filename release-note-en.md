# v0.2.5 - Bug Fixes for Local Stderr and Cache Scoping

## Changes

*   **Local MCP Stderr Leak Fix:** Suppressed child process stderr noise by switching to piped mode by default. Handshake failures now output a clean, bounded 8KB traceback. Added `stderr: "inherit"` config fallback for debugging.
*   **Auto-Update Cache Scoping Fix:** Fixed the cache invalidation directory scope so it deletes only `@openstellar/mcp-adapter` instead of the entire `@openstellar` organization path.
*   **Version Comparison Fix:** Implemented a robust parser for `isNewerVersion` that ignores prerelease/build metadata for pure stable version comparisons.

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.4...v0.2.5

# v0.2.4 - Auto-Update Checker

## Changes

*   **Auto-Update Check:** Compares local adapter version against NPM registry on startup and automatically invalidates outdated workspace caches.
*   **Toast Alerts:** Notifies users inside OpenCode when a newer adapter version is available.

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.3...v0.2.4

# v0.2.3 - Dynamic Version Handshake & Quieter Logs

## Changes

*   **Dynamic Handshake Version:** Read `@openstellar/mcp-adapter` version dynamically from `package.json` for clientInfo during MCP handshakes (replaces static v0.1.0).
*   **Reduced Schema Log Noise:** Silenced warning logs when JSON schema references fall back to string representations.

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.2...v0.2.3

# v0.2.2: Enabled Flag Support and Log Noise Reduction

## Changes

*   **MCP Configuration (`enabled` flag):** The adapter now correctly respects the `enabled: false` setting in the configuration. Disabled MCP servers will be filtered out and will not be loaded, improving resource efficiency and preventing unintended execution.
*   **Log Noise Reduction:** Changed the logging for `$ref` resolution fallback from `console.warn` to `console.debug`. This change reduces log noise by downgrading a non-error condition to a debug message.
*   **Type Safety Improvement:** Updated TypeScript interfaces (`McpConfigEntry`) to properly support the `enabled?: boolean` flag, preventing TypeErrors for consumers.
*   **Dynamic Tests:** Added dynamic unit tests for the configuration filtering behavior, removing reliance on specific, hardcoded test cases.

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.1...v0.2.2
