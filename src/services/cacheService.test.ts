import { CacheService } from './cacheService';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(1000); // 1 second TTL for tests
  });

  afterEach(() => {
    cache.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should store complex objects', () => {
      const obj = { name: 'test', count: 123, nested: { value: true } };
      cache.set('key1', obj);
      expect(cache.get('key1')).toEqual(obj);
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('expiration', () => {
    it('should expire values after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL

      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      cache.set('key1', 'value1'); // Uses 1000ms default

      expect(cache.get('key1')).toBe('value1');

      // Wait less than default TTL
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(cache.get('key1')).toBeNull();
    });

    it('should allow custom TTL per entry', async () => {
      cache.set('short', 'value1', 100);
      cache.set('long', 'value2', 500);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('short')).toBeNull();
      expect(cache.get('long')).toBe('value2');
    });
  });

  describe('delete', () => {
    it('should delete specific keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.size()).toBe(0);
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate keys matching prefix', () => {
      cache.set('user:1', 'data1');
      cache.set('user:2', 'data2');
      cache.set('swarm:1', 'data3');
      cache.set('swarm:2', 'data4');

      const count = cache.invalidatePattern('user:');

      expect(count).toBe(2);
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('user:2')).toBeNull();
      expect(cache.get('swarm:1')).toBe('data3');
      expect(cache.get('swarm:2')).toBe('data4');
    });

    it('should return 0 when no matches found', () => {
      cache.set('key1', 'value1');
      const count = cache.invalidatePattern('nomatch:');
      expect(count).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', async () => {
      cache.set('key1', 'value1', 100);

      expect(cache.has('key1')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size()).toBe(3);

      cache.delete('key1');
      expect(cache.size()).toBe(2);
    });
  });
});
