# OpenStellar MCP Adapter

**Connect any MCP server to OpenCode. One config entry. Zero guesswork.**

You already have MCP servers for web search, databases, file systems, design tools —
the ecosystem is growing fast. The problem is getting them all working inside OpenCode.

The adapter is the bridge. Add a server, it appears as tools. Handles schema conversion,
response flattening, timeouts, and error messages automatically.

---

## What You Get


| Feature                 | What it does                                                                            | Why it matters                                                     |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Plug & play**         | Add servers to `opencode.jsonc`, tools appear automatically                             | No manual tool definitions. No boilerplate.                        |
| **Schema conversion**   | Converts JSON Schema to Zod — handles `anyOf`, unions, nullable, `$ref`, merged objects | OpenCode needs Zod. MCP sends JSON Schema. One bridge, no crashes. |
| **Response flattening** | Turns images, audio, files, resource links into plain text                              | The LLM reads text, not base64. No silent data loss.               |
| **Token savings**       | `[image: image/png] (12KB)` instead of 600+ tokens of raw base64                        | Fewer tokens per response. Cheaper conversations.                  |
| **Timeout guard**       | 60s timeout, resets on server progress                                                  | No frozen conversations. Long-running tools still work.            |
| **Clean errors**        | `"Tool X on server Y failed: reason"` instead of stack traces                           | The LLM tells you what happened instead of throwing noise.         |
| **Smart naming**        | `notion` + `notion_search` → `notion_search`, not `notion_notion_search`                | Clean tool names. No repetition.                                   |
| **Auto-update**         | Checks npm registry on first session, invalidates stale cache, notifies you by toast    | Always runs the latest version. No manual cleanup.                |


---

## Get Started

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

Restart OpenCode. Tools appear. Done.

---

## Config


| Field     | Required     | Description                                |
| --------- | ------------ | ------------------------------------------ |
| `type`    | ✅            | `"local"` (stdio) or `"remote"` (HTTP SSE) |
| `command` | for `local`  | Child process args                         |
| `url`     | for `remote` | SSE endpoint                               |
| `headers` | optional     | Auth tokens, etc.                          |
| `env`     | optional     | Environment for child process              |
| `timeout` | optional     | Per-tool timeout in ms (default: 60000)    |


---

## How It Works

```
MCP Server ──→ Adapter ──→ OpenCode Tool
                  ├─ JSON Schema → Zod
                  ├─ Response flattening
                  ├─ Timeout guard
                  └─ Error wrapping
```

---

## Related Repositories

* [openstellar-tool-search](https://github.com/open-stl/openstellar-tool-search)
* [opencode-tool-search](https://github.com/M0Rf30/opencode-tool-search)
* [opencode-mcp-adapter](https://github.com/CloudedQuartz/opencode-mcp-adapter)

---

## License

MIT © 2026 OpenStellar