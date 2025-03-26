import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class PaginationService {
  private readonly logger = new Logger(PaginationService.name);
  private readonly cacheTTL = 600; // 10 minutes cache TTL for pagination tokens

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

  /**
   * Stores a pagination token with the corresponding page number in the cache
   */
  async storeToken(page: number, nextToken: string): Promise<void> {
    const cacheKey = `pagination:page:${page + 1}`;
    this.logger.debug(`Storing token for page ${page + 1}: ${nextToken}`);
    await this.cacheManager.set(cacheKey, nextToken, this.cacheTTL * 1000);
  }

  /**
   * Retrieves a pagination token for a given page number
   */
  async getToken(page: number): Promise<string | null> {
    if (page <= 1) {
      return null; // First page doesn't need a token
    }

    const cacheKey = `pagination:page:${page}`;
    const token = await this.cacheManager.get<string>(cacheKey);
    this.logger.debug(`Retrieved token for page ${page}: ${token}`);
    return token || null;
  }

  /**
   * Generates a client-side pagination response
   */
  createPaginationResponse<T>(
    items: T[],
    page: number,
    limit: number,
    hasNextPage: boolean,
    estimatedTotalItems?: number,
  ) {
    // If we don't have an exact count, estimate based on current page and items
    const totalItems = estimatedTotalItems || (hasNextPage ? page * limit + 1 : page * limit - limit + items.length);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage,
      hasPreviousPage: page > 1,
    };
  }
} 