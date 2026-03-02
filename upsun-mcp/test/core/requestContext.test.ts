import { describe, it, expect } from '@jest/globals';
import { requestContext } from '../../src/core/requestContext';

describe('requestContext', () => {
  it('should return undefined outside a run scope', () => {
    expect(requestContext.getStore()).toBeUndefined();
  });

  it('should provide the store inside a run scope', async () => {
    const fakeRes = { headersSent: false } as any;
    await requestContext.run({ res: fakeRes }, async () => {
      const store = requestContext.getStore();
      expect(store).toBeDefined();
      expect(store!.res).toBe(fakeRes);
    });
  });

  it('should return undefined after the run scope completes', async () => {
    const fakeRes = { headersSent: false } as any;
    await requestContext.run({ res: fakeRes }, async () => {});
    expect(requestContext.getStore()).toBeUndefined();
  });
});
