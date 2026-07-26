import test from 'node:test';
import assert from 'node:assert/strict';
import { createCacheService } from './cache.js';

test('cacheService memo returns cached value before ttl expires', async () => {
  const cache = createCacheService();
  let calls = 0;

  const first = await cache.memo('demo', 'a', 1000, async () => {
    calls += 1;
    return { calls };
  });
  const second = await cache.memo('demo', 'a', 1000, async () => {
    calls += 1;
    return { calls };
  });

  assert.deepEqual(first, { calls: 1 });
  assert.deepEqual(second, { calls: 1 });
  assert.equal(calls, 1);
});

test('cacheService invalidatePrefix removes matching keys in one namespace only', async () => {
  const cache = createCacheService();

  cache.set('demo', 'class:1', 'old', 1000);
  cache.set('demo', 'grade:1', 'kept', 1000);
  cache.set('other', 'class:1', 'other', 1000);
  cache.invalidatePrefix('demo', 'class:');

  assert.equal(cache.get('demo', 'class:1'), null);
  assert.equal(cache.get('demo', 'grade:1'), 'kept');
  assert.equal(cache.get('other', 'class:1'), 'other');
});
