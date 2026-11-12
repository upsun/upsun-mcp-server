import { describe, it, expect } from '@jest/globals';

import { UpsunMcpServer } from '../src/mcpUpsun';

const clientFor = (key: string, bearer = false) => {
  const server = new UpsunMcpServer();
  if (bearer) {
    server.useBearerToken(key);
  } else {
    server.useApiKey(key);
  }
  return server.client;
};

describe('UpsunMcpServer API-key client cache', () => {
  it('should reuse the client, and its access token, for the same API key', () => {
    const first = clientFor('cache-key-1');
    const second = clientFor('cache-key-1');
    expect(second).toBe(first);
  });

  it('should not share clients between different API keys', () => {
    const first = clientFor('cache-key-2');
    const second = clientFor('cache-key-3');
    expect(second).not.toBe(first);
  });

  it('should not cache bearer clients', () => {
    const first = clientFor('bearer-token', true);
    const second = clientFor('bearer-token', true);
    expect(second).not.toBe(first);
  });
});
