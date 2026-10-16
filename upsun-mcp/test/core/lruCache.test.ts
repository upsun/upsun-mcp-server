import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { LruCache } from '../../src/core/lruCache';

describe('LruCache', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return stored values and undefined for missing keys', () => {
    const cache = new LruCache<number>(2, 1000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('should evict the least recently used entry when full', () => {
    const cache = new LruCache<number>(2, 1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(2);
  });

  it('should expire entries idle for longer than the TTL', () => {
    jest.useFakeTimers();
    const cache = new LruCache<number>(2, 1000);
    cache.set('a', 1);
    jest.advanceTimersByTime(999);
    expect(cache.get('a')).toBe(1);
    jest.advanceTimersByTime(999);
    expect(cache.get('a')).toBe(1);
    jest.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('should replace an existing value', () => {
    const cache = new LruCache<number>(2, 1000);
    cache.set('a', 1);
    cache.set('a', 2);
    expect(cache.get('a')).toBe(2);
    expect(cache.size).toBe(1);
  });
});
