# OpenStellar MCP Adapter

OpenCode plugin that improves MCP compatibility with Gemini.

## What It Solves

- **Gemini compatibility** - Normalizes MCP tool schemas to meet Google Gemini's standard requirements
- **Tool hook compatibility** - Converts MCP tools to plugin tools, enabling `tool.definition` hook interception (required for opencode-tool-search and similar plugins that defer tool loading)

## Installation

```bash
npm install -g @openstellar/mcp-adapter
```

Add to `opencode.jsonc`:

```jsonc
{
  "plugin": [
    [
      "@openstellar/mcp-adapter@latest",
      {
        "mcp": {
          "example-remote": {
            "type": "remote",
            "url": "https://mcp.example.com/mcp",
            "headers": {
              "Authorization": "Bearer YOUR_TOKEN"
            }
          },
          "example-local": {
            "type": "local",
            "command": ["npx", "-y", "mcp-server-package"]
          }
        }
      }
    ]
  ]
}
```

## Config

**Remote server:**
```jsonc
{
  "type": "remote",
  "url": "https://mcp.example.com/mcp",
  "headers": { "Authorization": "Bearer ..." },
  "timeout": 30000  // optional
}
```

**Local server:**
```jsonc
{
  "type": "local",
  "command": ["npx", "-y", "package-name"],
  "env": { "API_KEY": "..." },  // optional
  "timeout": 180000  // optional, default 180s
}
```

## Debug

```bash
export OPENSTELLAR_MCP_DEBUG=true
```

Logs to `/tmp/openstellar-mcp-adapter.log`

## License

MIT © 2026 OpenStellar
