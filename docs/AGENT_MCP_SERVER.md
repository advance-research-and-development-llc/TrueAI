# MCP server (`scripts/mcp-server.mjs`)

**Plan item §E.** A minimal Model Context Protocol server that vends
TrueAI's local-first tool registry to any MCP-aware client (Claude
Desktop, Cursor, Continue, …) over stdio JSON-RPC 2.0.

## Why no `@modelcontextprotocol/sdk` dependency?

The on-the-wire MCP protocol is small enough to implement directly
(~50 LOC of JSON-RPC framing). Pulling in the SDK would expand
TrueAI's supply-chain surface for a marginal feature whose primary
audience is users who already run an MCP-aware IDE separately.

## Tools exposed

All tools are zero-network, zero-eval, no IO beyond the host clock.
This server intentionally does **not** vend network- or
credential-gated tools — MCP clients should call hosted LLMs
themselves; TrueAI's MCP server only provides safe local primitives.

| Tool          | Description                                                 |
| ------------- | ----------------------------------------------------------- |
| `currentTime` | ISO-8601 timestamp + IANA time zone                         |
| `mathEval`    | Local arithmetic eval (`+ - * / ( )`, decimals; 256-char cap) |

`kvStoreLookup` is intentionally **not** exposed: the KV store lives
in IndexedDB inside the running app, and an out-of-process MCP server
can't read it. We don't pretend otherwise.

## Wiring it into an MCP client

### Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json` (Linux) or
`~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS):

```json
{
  "mcpServers": {
    "trueai": {
      "command": "node",
      "args": ["/abs/path/to/TrueAI/scripts/mcp-server.mjs"]
    }
  }
}
```

### Cursor / Continue / generic MCP clients

Same shape — `command: node`, `args: [absolute path to script]`.

## Scripts

```bash
npm run mcp:server   # start the server (stdio JSON-RPC; daemon mode)
npm run mcp:smoke    # 6-case smoke test through a child process
```

## Protocol coverage

Implemented JSON-RPC methods:

- `initialize` — returns `serverInfo`, `protocolVersion`, `capabilities.tools`
- `notifications/initialized` (no response)
- `tools/list`
- `tools/call` — returns `{ content: [{ type: 'text', text }], isError }`
- `ping`

Unknown methods → `-32601` (Method not found). Bad JSON → `-32700`.
Unknown tool → `-32602`. Tool errors are returned as `isError: true`
on the result envelope, per the MCP spec.
