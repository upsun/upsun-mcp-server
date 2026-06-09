import { describe, expect, it } from '@jest/globals';
import { lean } from '../../src/core/lean';

/**
 * Behavioral gate for MR1 lean output (denylist).
 *
 * The contract is deliberately narrow: strip the HAL envelope (`_links`,
 * `_embedded`) from resource objects, pass every other field through, and never
 * touch a list envelope — because some list endpoints carry their pagination
 * cursor (`links.next`/`previous`) there and the tools instruct the agent to
 * follow it. These assertions pin exactly that, so a new API field rides through
 * untouched while a regression that drops pagination or leaks `_links` fails.
 */

// Bare-array list, as `environments.list()` / `activities.list()` return: each
// item carries the HAL `_links` block; there is no envelope.
const rawEnvironmentList = [
  {
    id: 'main',
    name: 'main',
    machine_name: 'main-abc123',
    type: 'production',
    status: 'active',
    created_at: '2025-05-28T00:00:00Z',
    has_staged_activities: false,
    _links: { self: { href: '/x' }, ssh: { href: 'ssh://x' }, '#activities': { href: '/a' } },
    _embedded: { foo: 'bar' },
  },
];

// Enveloped list, as `projects.list()` returns: pagination lives on the envelope
// under `links`; the items themselves have no `_links`.
const rawProjectList = {
  count: 1,
  items: [{ id: 'prj0000000001', title: 'Site', status: 'active', region: 'eu-5.platform.sh' }],
  facets: { count: 1 },
  links: { self: { href: '/projects' }, next: { href: '/projects?page=2' } },
};

// Hypothetical envelope whose pagination cursor sits under `_links` (the case
// the maintainer flagged). The strip must leave the envelope alone.
const rawEnvelopeHalLinks = {
  count: 1,
  items: [{ id: 'a', _links: { self: { href: '/a' } } }],
  _links: { self: { href: '/list' }, next: { href: '/list?page=2' } },
};

// Single resource, as `info()` / `get()` return.
const rawEnvironment = {
  id: 'main',
  name: 'main',
  status: 'active',
  _links: { self: { href: '/x' } },
  _embedded: { settings: {} },
};

describe('lean (MR1 denylist)', () => {
  describe('strips the HAL envelope from resource objects', () => {
    it('drops _links and _embedded from each list item', () => {
      const out = lean(rawEnvironmentList) as Array<Record<string, unknown>>;
      expect(out[0]).not.toHaveProperty('_links');
      expect(out[0]).not.toHaveProperty('_embedded');
    });

    it('drops _links and _embedded from a single resource', () => {
      const out = lean(rawEnvironment) as Record<string, unknown>;
      expect(out).not.toHaveProperty('_links');
      expect(out).not.toHaveProperty('_embedded');
    });
  });

  describe('passes every non-HAL field through (denylist, not allowlist)', () => {
    it('keeps an arbitrary field the API may add without a code change', () => {
      const out = lean(rawEnvironmentList) as Array<Record<string, unknown>>;
      // has_staged_activities is not "curated" — a denylist keeps it for free.
      expect(out[0]).toHaveProperty('has_staged_activities', false);
      expect(out[0]).toHaveProperty('machine_name', 'main-abc123');
      expect(out[0]).toHaveProperty('created_at', '2025-05-28T00:00:00Z');
    });

    it('output keys are exactly the input keys minus the HAL keys', () => {
      const out = lean(rawEnvironment) as Record<string, unknown>;
      expect(Object.keys(out).sort()).toEqual(['id', 'name', 'status']);
    });
  });

  describe('preserves the list envelope so pagination survives', () => {
    it('keeps envelope `links.next` and trims items (links under `links`)', () => {
      const out = lean(rawProjectList, { itemsKey: 'items' }) as Record<string, unknown>;
      expect(out).toHaveProperty('count', 1);
      expect(out).toHaveProperty('facets');
      expect((out.links as any).next.href).toBe('/projects?page=2');
    });

    it('keeps an envelope-level `_links` cursor untouched', () => {
      const out = lean(rawEnvelopeHalLinks, { itemsKey: 'items' }) as Record<string, unknown>;
      // Envelope `_links` is pagination — must survive.
      expect((out._links as any).next.href).toBe('/list?page=2');
      // But the item's own `_links` is stripped.
      const item = (out.items as Array<Record<string, unknown>>)[0];
      expect(item).not.toHaveProperty('_links');
      expect(item).toHaveProperty('id', 'a');
    });
  });

  describe('shape and safety', () => {
    it('passes null/undefined through unchanged', () => {
      expect(lean(null)).toBeNull();
      expect(lean(undefined)).toBeUndefined();
    });

    it('leaves a string array (e.g. plain URLs) untouched', () => {
      const urls = ['https://a.example.com', 'https://b.example.com'];
      expect(lean(urls)).toEqual(urls);
    });

    it('does not mutate its input', () => {
      const snapshot = JSON.stringify(rawEnvironmentList);
      lean(rawEnvironmentList);
      expect(JSON.stringify(rawEnvironmentList)).toBe(snapshot);
    });
  });
});
