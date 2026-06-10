#!/usr/bin/env bash
set -euo pipefail

# Build and pack for local testing
echo "=== Building @openstellar/mcp-adapter v0.2.0 ==="
npm run build

echo ""
echo "=== Running tests ==="
npm test

echo ""
echo "=== npm pack ==="
npm pack

TGZ=$(realpath openstellar-mcp-adapter-0.2.0.tgz)
echo ""
echo "=== Local .tgz ready ==="
echo "$TGZ"
echo ""
echo "=== Instructions ==="
echo "1. Copy opencode.local.jsonc to your config:"
echo "   cp opencode.local.jsonc ~/.config/opencode/opencode.jsonc"
echo ""
echo "2. Or merge into your existing config:"
echo "   Add this plugin entry to the 'plugin' array:"
echo '   ["file://'"$TGZ"'", { "mcp": { ... } }]'
echo ""
echo "3. Restart OpenCode to pick up the change"
