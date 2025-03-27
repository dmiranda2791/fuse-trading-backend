import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './portfolio.entity';
import { PortfolioItemDto } from './dto/portfolio.dto';
import { CursorPaginatedResponseDto } from '../common/dto/pagination.dto';

interface PortfolioCursor {
  offset: number;
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);
  private readonly pageSize = 10; // Default page size

  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
  ) {}

  /**
   * Get a user's portfolio with all their stock holdings using cursor-based pagination
   * @param userId The ID of the user whose portfolio to retrieve
   * @param nextToken Optional token for pagination
   * @returns Paginated portfolio data with holdings
   */
  async getUserPortfolio(
    userId: string,
    nextToken?: string,
  ): Promise<CursorPaginatedResponseDto<PortfolioItemDto>> {
    this.logger.debug(
      `Getting portfolio for user ${userId} with nextToken: ${nextToken || 'none'}`,
    );

    // Default offset is 0 (beginning of the list)
    let offset = 0;

    // Decode the cursor if provided
    if (nextToken) {
      try {
        const decodedCursor = Buffer.from(nextToken, 'base64').toString(
          'utf-8',
        );
        const cursor = JSON.parse(decodedCursor) as PortfolioCursor;
        offset = cursor.offset;
      } catch (error) {
        this.logger.error(
          `Invalid pagination token: ${nextToken}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new BadRequestException('Invalid pagination token');
      }
    }

    // Query the database with offset pagination
    const [portfolioItems, _totalCount] =
      await this.portfolioRepository.findAndCount({
        where: { userId },
        order: { symbol: 'ASC' },
        skip: offset,
        take: this.pageSize + 1, // Get one extra to check if there's more
      });

    if (!portfolioItems || portfolioItems.length === 0) {
      throw new NotFoundException(`Portfolio not found for user ${userId}`);
    }

    // Check if we have more items
    const hasNextPage = portfolioItems.length > this.pageSize;
    const items = hasNextPage
      ? portfolioItems.slice(0, this.pageSize)
      : portfolioItems;

    // Convert portfolio items to DTOs
    const portfolioItemDtos = this.convertToPortfolioItems(userId, items);

    // Create the paginated response
    const response: CursorPaginatedResponseDto<PortfolioItemDto> = {
      items: portfolioItemDtos,
      nextToken: null, // Null when there are no more pages
    };

    // Generate next token if there are more items
    if (hasNextPage) {
      const newCursor: PortfolioCursor = { offset: offset + this.pageSize };
      response.nextToken = Buffer.from(JSON.stringify(newCursor)).toString(
        'base64',
      );
    }

    return response;
  }

  /**
   * Convert portfolio items to DTOs with userId, symbol and quantity
   * @param userId The user ID
   * @param portfolioItems The portfolio items to convert
   * @returns Portfolio items with userId, symbol and quantity
   */
  private convertToPortfolioItems(
    userId: string,
    portfolioItems: Portfolio[],
  ): PortfolioItemDto[] {
    return portfolioItems.map(item => ({
      userId,
      symbol: item.symbol,
      quantity: item.quantity,
    }));
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

    this.logger.debug('Portfolio update completed');
  }
}
