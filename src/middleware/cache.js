const { redis, isRedisReady } = require('../config/redis');

const stats = { hits: 0, misses: 0 };

/**
 * Express caching middleware backed by Redis.
 * Usage: router.get('/', cache(60), handler)
 * Adds headers: X-Cache (HIT|MISS) and X-Response-Time.
 */
function cache(ttlSeconds = 60) {
  return async (req, res, next) => {
    if (!isRedisReady()) return next(); // app keeps working without Redis
    const key = `cache:${req.originalUrl}`;
    const started = process.hrtime.bigint();
    try {
      const hit = await redis.get(key);
      if (hit) {
        stats.hits++;
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        res.set('X-Cache', 'HIT').set('X-Response-Time', `${ms.toFixed(1)}ms`);
        return res.json(JSON.parse(hit));
      }
    } catch (e) {
      return next();
    }
    stats.misses++;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      res.set('X-Cache', 'MISS').set('X-Response-Time', `${ms.toFixed(1)}ms`);
      if (res.statusCode === 200) redis.set(key, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
      return originalJson(body);
    };
    next();
  };
}

async function clearCache() {
  if (!isRedisReady()) return 0;
  const keys = await redis.keys('cache:*');
  if (keys.length) await redis.del(keys);
  return keys.length;
}

module.exports = { cache, clearCache, stats };
