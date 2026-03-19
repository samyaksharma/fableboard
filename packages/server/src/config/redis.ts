import Redis from 'ioredis';
import { config } from './env.js';

let redis: Redis | null = null;
let redisAvailable = false;

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: () => null, // Don't auto-retry if initial connect fails
    });
    redis.on('error', () => {
      // Silenced — logged once on connect failure
    });
  }
  return redis;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.connect();
    redisAvailable = true;
    console.log('Connected to Redis');
    return true;
  } catch {
    console.warn('Redis not available — running without persistence');
    return false;
  }
}
