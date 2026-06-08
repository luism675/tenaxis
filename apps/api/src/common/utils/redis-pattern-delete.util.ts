import type IORedis from 'ioredis';

const REDIS_SCAN_COUNT = 200;
const REDIS_DELETE_BATCH_SIZE = 500;

export async function deleteRedisKeysByPattern(
  redis: IORedis,
  patterns: string[],
): Promise<number> {
  let deleted = 0;

  for (const pattern of patterns) {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        REDIS_SCAN_COUNT,
      );

      cursor = nextCursor;

      for (
        let index = 0;
        index < keys.length;
        index += REDIS_DELETE_BATCH_SIZE
      ) {
        const batch = keys.slice(index, index + REDIS_DELETE_BATCH_SIZE);
        if (batch.length > 0) {
          deleted += await redis.del(...batch);
        }
      }
    } while (cursor !== '0');
  }

  return deleted;
}
