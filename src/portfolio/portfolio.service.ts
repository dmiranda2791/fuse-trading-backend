import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './portfolio.entity';
import { PortfolioResponseDto, PortfolioItemDto } from './dto/portfolio.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get a user's portfolio with all their stock holdings
   * @param userId The ID of the user whose portfolio to retrieve
   * @returns Portfolio data with holdings
   */
  async getUserPortfolio(userId: string): Promise<PortfolioResponseDto> {
    // Try to get from cache first
    const cacheKey = `portfolio:${userId}`;
    const cachedPortfolio =
      await this.cacheManager.get<PortfolioResponseDto>(cacheKey);

    if (cachedPortfolio) {
      return cachedPortfolio;
    }

    // If not in cache, get from database
    const holdings = await this.portfolioRepository.find({
      where: { userId },
    });

    if (!holdings || holdings.length === 0) {
      throw new NotFoundException(`Portfolio not found for user ${userId}`);
    }

    // Map to response DTO
    const portfolioItems: PortfolioItemDto[] = holdings.map(holding => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
    }));

    // Calculate totals
    const totalStocks = portfolioItems.length;
    const totalShares = portfolioItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    // Create response
    const response: PortfolioResponseDto = {
      userId,
      holdings: portfolioItems,
      totalStocks,
      totalShares,
    };

    // Cache the result with a 15-minute TTL
    await this.cacheManager.set(cacheKey, response, 15 * 60 * 1000);

    return response;
  }

  /**
   * Update a user's portfolio after a successful trade
   * @param userId The user ID
   * @param symbol The stock symbol
   * @param quantity The quantity to add (positive) or remove (negative)
   */
  async updatePortfolio(
    userId: string,
    symbol: string,
    quantity: number,
  ): Promise<void> {
    this.logger.debug(
      `Starting portfolio update for user ${userId}, symbol ${symbol}, quantity ${quantity}`,
    );

    // Check if user already has this stock
    this.logger.debug('Finding existing holding in database');
    const existingHolding = await this.portfolioRepository.findOne({
      where: { userId, symbol },
    });

    if (existingHolding) {
      // Update existing holding
      existingHolding.quantity += quantity;

      if (existingHolding.quantity <= 0) {
        // Remove the holding if quantity becomes zero or negative
        this.logger.debug('Removing holding (quantity <= 0)');
        await this.portfolioRepository.remove(existingHolding);
      } else {
        // Save the updated quantity
        this.logger.debug('Saving updated holding quantity');
        await this.portfolioRepository.save(existingHolding);
      }
    } else if (quantity > 0) {
      // Create new holding only if quantity is positive
      this.logger.debug('Creating new holding');
      const newHolding = this.portfolioRepository.create({
        userId,
        symbol,
        quantity,
      });
      await this.portfolioRepository.save(newHolding);
    }

    // Invalidate cache for this user's portfolio
    this.logger.debug('Invalidating portfolio cache');
    await this.cacheManager.del(`portfolio:${userId}`);

    this.logger.debug('Portfolio update completed');
  }
}
