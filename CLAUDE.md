# Upsun MCP Server — Contributor Guide

This file holds what you **cannot** infer from the code or the README: the
non-obvious invariants, the conventions, and the few traps that break things
silently when violated.

- **Usage, hosted setup, client config, tool list** → [README.md](./README.md). Not repeated here.
- **Commands** → [`upsun-mcp/package.json`](./upsun-mcp/package.json) scripts. Not repeated here.
- **The npm project lives in `upsun-mcp/`**, not the repo root. `cd upsun-mcp` before `npm` anything.

---

## Where the code lives

```
upsun-mcp/src/
├── index.ts          # Entry point. Picks transport from appConfig.typeEnv (McpType.LOCAL → stdio, else HTTP).
├── mcpUpsun.ts        # UpsunMcpServer. Constructor registers every command + task module.
├── core/
│   ├── adapter.ts     # McpAdapter interface — the contract command modules register against.
│   ├── gateway.ts     # LocalServer (stdio) and GatewayServer (HTTP) bootstrap classes.
│   ├── transport/
│   │   ├── http.ts    # Streamable HTTP + session handling. Sets enableJsonResponse.
│   │   └── sse.ts     # Legacy SSE transport.
│   ├── authentication.ts # Token extraction, write gating, session-token binding.
│   ├── config.ts      # appConfig, apiConfig, oauth2Config, otelConfig, storageConfig.
│   ├── lean.ts        # HAL-envelope stripping for read tools (see Invariants).
│   ├── helper.ts      # Schema, Response, Assert, ToolWrapper, forwardUpstream401.
│   ├── telemetry.ts   # OpenTelemetry. See OPENTELEMETRY.md.
│   ├── requestContext.ts # AsyncLocalStorage holding the Express response.
│   ├── types.ts       # McpType and shared types.
│   └── logger.ts      # pino. createLogger('MCP:Tool:<name>').
├── command/           # One module per resource. register<X>(adapter) each.
└── task/              # MCP prompts. config.ts → registerConfig.
```

> Keep this tree honest. If you add a file under `core/`, add the line here in the same PR.

---

## Non-obvious invariants

Violate one of these and the server still compiles, still passes a smoke test,
and breaks in production. Read before touching auth, transport, or read tools.

### Session binding is to the token, not the session id
A stateful session stores a SHA-256 hash of the credential token that created
it (`sessionOwnerFromAuth` in `authentication.ts`). Every reuse of an
`mcp-session-id` must present a token with the same hash
(`authMatchesSessionOwner`, constant-time compared). A mismatch — including an
unknown id — returns `404 Session not found`. The two are indistinguishable on
purpose, so the id cannot probe for live sessions. Binding to the token (not a
JWT claim) means it holds without verifying the signature: a leaked id is
useless without the token.

### 401 forwarding only works on Streamable HTTP
When the Upsun API returns `401`, `forwardUpstream401` (`helper.ts`) pulls the
Express response out of `requestContext` and writes the status plus the
`WWW-Authenticate` header, so the client can refresh its OAuth2 token. That
write is only possible because `transport/http.ts` sets
`enableJsonResponse: true`, which defers the headers until the handler returns.
**SSE commits `200` headers immediately, so 401 forwarding is impossible
there.** Bearer Streamable HTTP requests are stateless (fresh transport per
POST); GET/DELETE return `405 Allow: POST`.

### Read tools strip the HAL envelope — but never from the list wrapper
`lean.ts` removes `_links` and `_embedded` from every resource object (~68%
payload cut on an environment list). It is a **denylist**: new API fields pass
through automatically. The list *envelope* is exempt, because pagination
cursors (`links.next.href`) live there and tools instruct the agent to follow
them. Callers opt back into raw HAL with `full: true`.

### `list()` and `info()`/`get()` return different shapes
The Upsun SDK's `list()` returns raw snake_case HAL. `info()`/`get()`
deserialize to camelCase objects. The `.d.ts` types claim otherwise — don't
trust them; check the runtime shape.

### Two API-key env vars, by transport
- stdio / `LocalServer` reads **`UPSUN_API_KEY`** (required).
- HTTP / remote reads the token from headers; `config.ts` also exposes
  `UPSUN_API_TOKEN` (`apiToken`) and `UPSUN_API_KEY` (`apiKey`).

---

## Conventions

### Adding a command
Three edits, always in this order:

1. **`src/command/<feature>.ts`** — export `register<Feature>(adapter: McpAdapter)`.
   Inside, call `adapter.server.registerTool(...)` with a `zod` input schema
   (use `Schema.projectId()` etc. from `helper.ts`), and return `Response.json(result)`.
   Logger: `const log = createLogger('MCP:Tool:<feature>-commands')`.
2. **`src/command/index.ts`** — `export * from './<feature>.js'`.
3. **`src/mcpUpsun.ts`** — import `register<Feature>` and call it in the constructor.

**A read tool takes two more steps**, or it silently ships the HAL envelope:
add `full: Schema.full()` to the input schema, and return
`Response.json(full ? result : lean(result))`. For an enveloped list, pass the
array key — `lean(result, { itemsKey: 'items' })` — so the envelope's
pagination cursors survive.

Write operations are gated by `WritableMode` — `READONLY` / `NON_DESTRUCTIVE` /
`WRITABLE`, resolved from the `MODE` env var (`config.ts`) and the `enable-write`
header (`authentication.ts`). Default is `READONLY`.

### Tests
- Mirror `src/` under `test/`. Mock the Upsun SDK client; assert param
  validation and error handling.
- Coverage gate: `npm run coverage:check`. Thresholds — global plus per-folder
  overrides — live in `jest.config.ts`, not in the script. Don't merge below them.

---

## Quick loop

```bash
cd upsun-mcp
npm run build && TYPE_ENV=local npm run run  # stdio mode from compiled output (needs UPSUN_API_KEY)
npm run test:watch
```

Everything else (lint, prettier, coverage, build) is a script in `package.json`.
`npm run watch` restarts the server on source changes — HTTP mode by default;
set `TYPE_ENV=local` for stdio.
