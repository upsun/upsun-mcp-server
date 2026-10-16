import { describe, it, expect, jest } from '@jest/globals';

import { UpsunMcpServer } from '../src/mcpUpsun';

const connect = async (key: string, bearer = false) => {
  const server = new UpsunMcpServer();
  jest.spyOn(server.server, 'connect').mockImplementation(async () => {});
  const transport = {} as any;
  if (bearer) {
    await server.connectWithBearer(transport, key);
  } else {
    await server.connectWithApiKey(transport, key);
  }
  return server.client;
};

describe('UpsunMcpServer API-key client cache', () => {
  it('should reuse the client, and its access token, for the same API key', async () => {
    const first = await connect('cache-key-1');
    const second = await connect('cache-key-1');
    expect(second).toBe(first);
  });

  it('should not share clients between different API keys', async () => {
    const first = await connect('cache-key-2');
    const second = await connect('cache-key-3');
    expect(second).not.toBe(first);
  });

  it('should not cache bearer clients', async () => {
    const first = await connect('bearer-token', true);
    const second = await connect('bearer-token', true);
    expect(second).not.toBe(first);
  });
});
