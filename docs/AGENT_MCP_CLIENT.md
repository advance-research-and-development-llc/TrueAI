# MCP client (`scripts/mcp-client.mjs`)

**Plan item §W.** A minimal Node-only stdio MCP client that connects
to any external MCP server and exposes its tools through a small
library API and a CLI.

## Scope

- **Node-only.** TrueAI itself runs in Capacitor Android / Vite
  browser contexts where `child_process` and stdio aren't available.
  This client is for offline workflows: agent-replay scripts, smoke
  tests, dev-time inspection of third-party MCP servers, and as a
  building block for future server-side dispatchers.
- **Zero dependencies.** Same rationale as the §E server — the MCP
  on-the-wire protocol is small enough to drive directly.

## Library usage

```js
import { McpClient } from './scripts/mcp-client.mjs'

const c = new McpClient({
  command: 'node',
  args: ['./scripts/mcp-server.mjs'],
  timeoutMs: 10_000,    // optional; default 10s
})

await c.connect()
const tools = await c.listTools()
const result = await c.callTool('mathEval', { expression: '(2+3)*4' })
//   → { content: [{ type:'text', text:'{"result":20,...}' }], isError:false }
await c.close()
```

Tool errors come back as `{ isError: true, content: [...] }` per the
MCP spec. JSON-RPC errors (`-32601`, `-32602`, …) reject the promise
with an `Error` whose `.code` and `.data` match the server response.

## CLI usage

```bash
# List tools the server exposes
node scripts/mcp-client.mjs --server "node ./scripts/mcp-server.mjs" --list

# Call a tool with JSON arguments
node scripts/mcp-client.mjs \
  --server "node ./scripts/mcp-server.mjs" \
  --call mathEval --args '{"expression":"(2+3)*4"}'
```

Flags:

| Flag                  | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `--server "<cmd>"`    | Command to spawn the MCP server (split on whitespace)         |
| `--list`              | Print the server's `tools/list` output as JSON                |
| `--call <toolName>`   | Invoke a tool by name                                         |
| `--args '<json>'`     | JSON arguments for `--call` (default `{}`)                    |
| `--timeout <ms>`      | Per-request timeout in milliseconds (default `10000`)         |
| `--help`              | Show usage                                                    |

Exit codes: `0` on success, `1` on tool error (`isError: true`) or
JSON-RPC error, `2` on usage / missing flags.

## npm scripts

```bash
npm run mcp:client          # run the CLI (passes flags through)
npm run mcp:client-smoke    # 5-case smoke test against scripts/mcp-server.mjs
```

## Round-trip with the §E server

The smoke test (`scripts/mcp-client.smoke.mjs`) connects to TrueAI's
own MCP server (§E) and asserts:

1. `initialize` returns `serverInfo.name === 'trueai-local'`
2. `tools/list` returns `['currentTime', 'mathEval']`
3. `mathEval { expression: "(2+3)*4" }` → `result === 20`, `isError: false`
4. `mathEval { expression: "os.exit()" }` → `isError: true`,
   text matches `/unsupported characters/`
5. `tools/call` for an unknown tool rejects with `code === -32602`
