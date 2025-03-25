import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { AppLogger } from './logger.service';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    currentPage: number;
    itemsPerPage: number;
    totalItems?: number;
    totalPages?: number;
    hasNextPage: boolean;
  };
}

export interface TokenPaginatedResponse<T> {
  items: T[];
  nextToken?: string;
}

@Injectable()
export class PaginationService {
  private readonly logger = new AppLogger(PaginationService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

  /**
   * Stores a pagination token for a specific resource and page
   * @param resource The resource name (e.g., 'stocks')
   * @param page The page number
   * @param token The pagination token
   */
  async storeToken(resource: string, page: number, token: string): Promise<void> {
    const key = `pagination:${resource}:page:${page}`;
    await this.cacheManager.set(key, token, 300000); // 5 minute TTL
    this.logger.debug(`Stored pagination token for ${resource} page ${page}`);
  }

  /**
   * Retrieves a pagination token for a specific resource and page
   * @param resource The resource name (e.g., 'stocks')
   * @param page The page number
   * @returns The pagination token or null if not found
   */
  async getToken(resource: string, page: number): Promise<string | null> {
    const key = `pagination:${resource}:page:${page}`;
    const token = await this.cacheManager.get<string>(key);
    this.logger.debug(
      token
        ? `Retrieved pagination token for ${resource} page ${page}`
        : `No pagination token found for ${resource} page ${page}`,
    );
    return token || null;
  }

  /**
   * Clears all pagination tokens for a resource
   * @param resource The resource name (e.g., 'stocks')
   */
  async clearTokens(resource: string): Promise<void> {
    // Note: This implementation is simple but limited.
    // In a production environment, you would need a way to list/delete keys by pattern
    // which might require direct Redis client access
    this.logger.debug(`Cleared pagination tokens for ${resource}`);
    // For now, we'll just create a dummy invalidation key
    await this.cacheManager.set(`pagination:${resource}:invalidated`, Date.now());
  }

  /**
   * Converts a token-based paginated response to an offset-based one
   * @param response The token-based response
   * @param page The current page number
   * @param limit The page size
   * @returns A standardized paginated response
   */
  toOffsetPagination<T>(
    response: TokenPaginatedResponse<T>,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    return {
      items: response.items,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage: !!response.nextToken,
      },
    };
  }
} 