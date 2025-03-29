import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { Stock } from './stock.entity';
import { StocksHttpService } from './stocks-http.service';
import { StockDto } from './dto/stock.dto';
import { StockListResponseDto } from './dto/stock-list.dto';

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);
  private readonly cacheTTL = 300; // 5 minutes cache TTL

  constructor(
    private readonly stocksHttpService: StocksHttpService,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get a single stock by symbol
   */
  async getStockBySymbol(symbol: string): Promise<StockDto> {
    // Try to get from cache first
    const cacheKey = `stock:${symbol}`;
    const cachedStock = await this.cacheManager.get<StockDto>(cacheKey);

    if (cachedStock) {
      this.logger.debug(`Cache hit for stock: ${symbol}`);
      return cachedStock;
    }

    // If not in cache, try to get from the database
    const stock = await this.stockRepository.findOne({ where: { symbol } });

    if (stock && this.isStockCacheValid(stock.lastFetchedAt)) {
      this.logger.debug(`Database hit for stock: ${symbol}`);

      const stockDto = this.mapToStockDto(stock);
      await this.cacheManager.set(cacheKey, stockDto, this.cacheTTL * 1000);

      return stockDto;
    }

    // If not in database or cache is stale, fetch from vendor API
    this.logger.debug(`Fetching stock from vendor API: ${symbol}`);
    const stocks = await this.fetchStocksFromVendor();

    const foundStock = stocks.find(s => s.symbol === symbol);
    if (!foundStock) {
      throw new NotFoundException(`Stock with symbol ${symbol} not found`);
    }

    // Store in cache
    await this.cacheManager.set(cacheKey, foundStock, this.cacheTTL * 1000);

    return foundStock;
  }

  /**
   * Get a list of stocks with pagination
   */
  async getStocks(nextToken?: string): Promise<StockListResponseDto> {
    this.logger.debug(`Getting stocks with nextToken: ${nextToken || 'none'}`);

    // Directly call the vendor API with the provided nextToken
    const result = await this.stocksHttpService.getStocks(nextToken);

    // Map vendor stocks to our DTO format
    const stocks = result.items.map(item => ({
      symbol: item.symbol,
      name: item.name,
      price: item.price,
    }));

    // Update stocks in the database
    await this.updateStocksInDatabase(stocks);

    // Cache individual stocks
    await this.cacheStocks(stocks);

    // Return cursor-based response
    return {
      items: stocks,
      nextToken: result.nextToken || null,
    };
  }

  /**
   * Fetch all stocks from vendor API (internal method)
   */
  async fetchStocksFromVendor(): Promise<StockDto[]> {
    const cacheKey = 'stocks:all';
    const cachedStocks = await this.cacheManager.get<StockDto[]>(cacheKey);

    if (cachedStocks) {
      this.logger.debug('Using cached stocks list');
      return cachedStocks;
    }

    this.logger.debug('Fetching all stocks from vendor API');

    const stocks: StockDto[] = [];
    let nextToken: string | undefined = undefined;

    // Keep fetching pages until there's no nextToken
    do {
      const result = await this.stocksHttpService.getStocks(nextToken);
      stocks.push(
        ...result.items.map(item => ({
          symbol: item.symbol,
          name: item.name,
          price: item.price,
        })),
      );

      nextToken = result.nextToken;
    } while (nextToken);

    // Cache the complete list
    await this.cacheManager.set(cacheKey, stocks, this.cacheTTL * 1000);

    // Update database records
    await this.updateStocksInDatabase(stocks);

    return stocks;
  }

  /**
   * Store or update stocks in the database
   */
  private async updateStocksInDatabase(stocks: StockDto[]): Promise<void> {
    const now = new Date();

    for (const stockDto of stocks) {
      await this.stockRepository.save({
        ...stockDto,
        lastFetchedAt: now,
      });
    }
  }

  /**
   * Cache individual stocks
   */
  private async cacheStocks(stocks: StockDto[]): Promise<void> {
    for (const stock of stocks) {
      const cacheKey = `stock:${stock.symbol}`;
      await this.cacheManager.set(cacheKey, stock, this.cacheTTL * 1000);
    }
  }

  /**
   * Check if the stock's cached data is still valid
   */
  private isStockCacheValid(lastFetchedAt: Date): boolean {
    if (!lastFetchedAt) return false;

    const now = new Date();
    const cacheAge = now.getTime() - lastFetchedAt.getTime();
    return cacheAge < this.cacheTTL * 1000;
  }

  /**
   * Map database entity to DTO
   */
  private mapToStockDto(stock: Stock): StockDto {
    return {
      symbol: stock.symbol,
      name: stock.name,
      price: stock.price,
    };
  }
}
