import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  SetMetadata,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppLogger } from '../utils/logger.service';
import { Request } from 'express';

// Decorator to set cache TTL for controllers or methods
export const CacheTTL = (ttl: number) => SetMetadata('cache_ttl', ttl);

// Decorator to exclude routes from caching
export const NoCache = () => SetMetadata('no_cache', true);

interface HttpRequest extends Request {
  url: string;
  method: string;
  query: Record<string, string>;
}

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new AppLogger(HttpCacheInterceptor.name);
  private readonly defaultTTL = 300; // 5 minutes default

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // Check if caching is disabled for this route
    const noCache = this.reflector.get<boolean>(
      'no_cache',
      context.getHandler(),
    );
    if (noCache) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Extract route-specific TTL
    const ttl =
      this.reflector.get<number>('cache_ttl', context.getHandler()) ||
      this.reflector.get<number>('cache_ttl', context.getClass()) ||
      this.defaultTTL;

    // Generate a cache key based on the request URL and query params
    const cacheKey = this.generateCacheKey(request);

    // Try to get the response from cache
    const cachedResponse = await this.cacheManager.get(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return of(cachedResponse);
    }

    this.logger.debug(`Cache miss for key: ${cacheKey}`);

    // If cache miss, proceed with the request and store the response
    return next.handle().pipe(
      tap(response => {
        // Store the response in cache - don't await this to avoid blocking
        void this.cacheManager.set(cacheKey, response, ttl * 1000);
        this.logger.debug(
          `Cached response for key: ${cacheKey} with TTL: ${ttl}s`,
        );
      }),
    );
  }

  private generateCacheKey(request: HttpRequest): string {
    const url = request.url;
    // Sort query params to ensure consistent keys regardless of param order
    const queryParams = { ...request.query };
    const sortedQueryParams = Object.keys(queryParams)
      .sort()
      .reduce<Record<string, string>>((result, key) => {
        result[key] = queryParams[key];
        return result;
      }, {});

    return `${url}?${JSON.stringify(sortedQueryParams)}`;
  }
}
