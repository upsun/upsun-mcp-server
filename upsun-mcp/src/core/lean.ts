/**
 * @fileoverview Lean output for read tools (MR1).
 *
 * The Upsun API returns raw HAL: every resource carries a `_links` block
 * (~28 entries on an environment) and sometimes an `_embedded` block. An MCP
 * client invokes actions by tool name, not by following hypermedia links, so
 * that envelope is dead weight it pays for in context tokens. Stripping it from
 * an environment list cuts ~68% of the payload.
 *
 * This is a denylist, not an allowlist: we remove the two HAL keys and pass
 * everything else through. New API fields appear automatically, and there is
 * nothing per-resource to maintain — the rule is global to every read tool.
 *
 * One thing must survive: pagination. Some list endpoints return their
 * next/previous page cursor in the response *envelope* (the wrapper around the
 * items array), and the tools instruct the agent to follow `links.next.href`.
 * So the HAL keys are stripped only from resource objects — list items and
 * single `info`/`get` results — never from the list envelope. Callers opt back
 * into the raw payload with `full: true`.
 */

/** HAL keys removed from every resource object. */
const HAL_KEYS = new Set(['_links', '_embedded']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Return a shallow copy of a resource object with the HAL keys removed. Every
 * other field passes through untouched. Non-objects are returned as-is.
 */
function stripHal(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!HAL_KEYS.has(key)) {
      out[key] = value[key];
    }
  }
  return out;
}

/**
 * Options controlling how {@link lean} interprets the payload shape.
 */
export interface LeanOptions {
  /**
   * For an enveloped list (e.g. `{count, items, facets, links}`), the key
   * holding the resource array. The envelope itself — including its pagination
   * `links`/`_links` — is preserved; only the items are stripped. Omit for
   * bare-array or single-object payloads.
   */
  itemsKey?: string;
}

/**
 * Strip the HAL envelope from a read-tool payload. Handles the three shapes the
 * read tools return:
 *
 *  - bare array of resources → each item stripped;
 *  - enveloped list (`opts.itemsKey`) → envelope kept (pagination intact), items stripped;
 *  - single resource object → stripped.
 *
 * Returns the input unchanged for null/undefined or unrecognized shapes, so the
 * result can always go straight to `Response.json`.
 *
 * @param data - The raw API result.
 * @param opts - Shape hints (e.g. `itemsKey` for enveloped lists).
 */
export function lean(data: unknown, opts: LeanOptions = {}): unknown {
  if (data == null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(stripHal);
  }

  if (opts.itemsKey) {
    const envelope = data as Record<string, unknown>;
    const inner = envelope[opts.itemsKey];
    if (Array.isArray(inner)) {
      return { ...envelope, [opts.itemsKey]: inner.map(stripHal) };
    }
    return data;
  }

  if (isPlainObject(data)) {
    return stripHal(data);
  }

  return data;
}
