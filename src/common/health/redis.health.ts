import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly configService: ConfigService) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');
    const client = createClient({
      url: `redis://${host}:${port}`,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      await client.disconnect();

      const result: HealthIndicatorResult = {
        [key]: {
          status: pong === 'PONG' ? 'up' : 'down',
          host,
          port,
        },
      };

      return result;
    } catch (error) {
      await client.disconnect().catch(() => {});

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        [key]: {
          status: 'down',
          host,
          port,
          message: errorMessage,
        },
      };
    }
  }
}
