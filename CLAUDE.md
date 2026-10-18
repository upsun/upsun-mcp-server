# CLAUDE.md

Usage and setup are in [README.md](./README.md). The npm project is in
`upsun-mcp/`; its scripts are in [`package.json`](./upsun-mcp/package.json).

## Adding a command

1. `src/command/<feature>.ts`: export `register<Feature>(adapter: McpAdapter)`,
   registering tools with `zod` schemas built from `Schema` in `helper.ts`.
2. Export it from `src/command/index.ts`.
3. Call it in the `UpsunMcpServer` constructor (`src/mcpUpsun.ts`).

Read tools add `full: Schema.full()` to the schema and return
`Response.json(full ? result : lean(result))`. For an enveloped list, pass
`lean(result, { itemsKey: 'items' })` so the pagination links survive.

## Gotchas

- Write tools are off by default; only the `enable-write` header enables them.
- The Upsun SDK's `list()` returns snake_case HAL; `info()`/`get()` return
  camelCase objects. The `.d.ts` types don't reflect this.
- HTTP is stateless (MCP spec 2026-07-28): each POST to `/mcp` gets a fresh
  `UpsunMcpServer` and transport, so state can't persist between requests. The
  one exception: API-key `UpsunClient`s (and their access tokens) are cached
  in `mcpUpsun.ts`, keyed by a hash of the key.
- Forwarding an upstream 401 (`forwardUpstream401`) relies on
  `enableJsonResponse: true` in `transport/http.ts`, which delays the headers.
- Coverage thresholds are in `jest.config.ts`; check with `npm run coverage:check`.
