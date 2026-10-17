import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { createShutdownHandler } from '../../src/core/shutdown';

describe('createShutdownHandler', () => {
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.useFakeTimers();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    exitSpy.mockRestore();
  });

  it('should flush then exit 0', async () => {
    const flush = jest.fn(async () => {});

    await createShutdownHandler(flush)();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should still exit 0 when flush rejects', async () => {
    const flush = jest.fn(async () => {
      throw new Error('exporter down');
    });

    await createShutdownHandler(flush)();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should ignore a repeated signal', async () => {
    let release!: () => void;
    const flush = jest.fn(() => new Promise<void>(resolve => (release = resolve)));
    const cleanup = createShutdownHandler(flush);

    const first = cleanup();
    await cleanup();
    expect(exitSpy).not.toHaveBeenCalled();

    release();
    await first;
    expect(flush).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit 1 when flush stalls past the timeout', () => {
    const flush = jest.fn(() => new Promise<void>(() => {}));

    void createShutdownHandler(flush, 1000)();
    jest.advanceTimersByTime(999);
    expect(exitSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
