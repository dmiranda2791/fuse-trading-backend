import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { NoCache } from '../interceptors/cache.interceptor';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private typeOrm: TypeOrmHealthIndicator,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  @NoCache() // Ensure we don't cache health check results
  @ApiOperation({ summary: 'Check the health of the application' })
  @ApiResponse({ status: 200, description: 'The application is healthy' })
  @ApiResponse({ status: 503, description: 'The application is not healthy' })
  check() {
    //const vendorApiUrl = this.configService.get<string>('api.baseUrl');

    return this.health.check([
      // Check database connection
      () => this.typeOrm.pingCheck('database'),

      // Check Redis connection
      () => this.redis.pingCheck('redis'),

      // Check vendor API availability
      //() => this.http.pingCheck('vendor-api', `${vendorApiUrl}/health`),

      // Check memory usage
      () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024), // 250MB

      // Check disk space if in production
      ...(process.env.NODE_ENV === 'production'
        ? [
            () =>
              this.disk.checkStorage('disk', {
                path: '/',
                thresholdPercent: 0.9,
              }),
          ]
        : []),
    ]);
  }
}
