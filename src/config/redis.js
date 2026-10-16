const Redis = require('ioredis');

// Connection options shared by BullMQ (queue/worker) and the cache client.
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null
};

const redis = new Redis(connection);
let ready = false;
redis.on('ready', () => { ready = true; console.log('[redis] connected'); });
redis.on('error', (e) => { ready = false; console.error('[redis] error:', e.message); });
redis.on('close', () => { ready = false; });

module.exports = { redis, connection, isRedisReady: () => ready };
