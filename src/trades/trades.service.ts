import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, TradeStatus } from './trade.entity';
import { BuyStockDto } from './dto/buy-stock.dto';
import { TradeResponseDto } from './dto/trade-response.dto';
import { StocksService } from '../stocks/stocks.service';
import { TradesHttpService } from './trades-http.service';
import { PortfolioService } from '../portfolio/portfolio.service';

@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);
  private readonly priceTolerancePercent = 2; // 2% tolerance

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly stocksService: StocksService,
    private readonly tradesHttpService: TradesHttpService,
    private readonly portfolioService: PortfolioService,
  ) {}

  /**
   * Execute a buy order for a stock
   *
   * @param userId User making the trade
   * @param symbol Stock symbol
   * @param buyStockDto Price and quantity
   * @returns Trade response
   */
  async buyStock(
    userId: string,
    symbol: string,
    buyStockDto: BuyStockDto,
  ): Promise<TradeResponseDto> {
    this.logger.debug(
      `Processing buy order: ${symbol} x${buyStockDto.quantity} @ $${buyStockDto.price} for user ${userId}`,
    );

    // Create a trade record with PENDING status
    const trade = this.tradeRepository.create({
      userId,
      symbol,
      price: buyStockDto.price,
      quantity: buyStockDto.quantity,
      status: TradeStatus.PENDING,
      timestamp: new Date(),
    });

    this.logger.debug('Saving initial trade record to database');
    await this.tradeRepository.save(trade);

    try {
      // Get current price from the stock service
      this.logger.debug('Looking up current stock price');
      const stock = await this.stocksService.getStockBySymbol(symbol);

      // Check if price is within the acceptable range (±2%)
      const isPriceValid = this.isPriceWithinTolerance(
        buyStockDto.price,
        stock.price,
      );

      if (!isPriceValid) {
        const lowerBound = stock.price * (1 - this.priceTolerancePercent / 100);
        const upperBound = stock.price * (1 + this.priceTolerancePercent / 100);

        this.logger.debug(
          'Price validation failed, updating trade status to FAILED',
        );
        await this.updateTradeStatus(
          trade.id,
          TradeStatus.FAILED,
          `Price out of acceptable range. Current price: $${stock.price}, acceptable range: $${lowerBound.toFixed(4)} - $${upperBound.toFixed(4)}`,
        );

        throw new BadRequestException({
          errorCode: 'VAL_002',
          message: 'Price out of acceptable range',
          details: {
            providedPrice: buyStockDto.price,
            currentPrice: stock.price,
            allowedRange: [
              Number(lowerBound.toFixed(4)),
              Number(upperBound.toFixed(4)),
            ],
          },
        });
      }

      // Execute trade via vendor API
      this.logger.debug('Executing trade with vendor API');
      const buyResponse = await this.tradesHttpService.buyStock(
        symbol,
        buyStockDto,
      );

      if (buyResponse.success === false) {
        this.logger.debug(
          'Vendor API rejected trade, updating trade status to FAILED',
        );
        await this.updateTradeStatus(
          trade.id,
          TradeStatus.FAILED,
          buyResponse.message,
        );

        throw new BadRequestException({
          errorCode: 'API_001',
          message: buyResponse.message,
          details: { symbol, price: buyStockDto.price },
        });
      }

      // Update trade status to SUCCESS
      this.logger.debug('Trade successful, updating trade status to SUCCESS');
      await this.updateTradeStatus(trade.id, TradeStatus.SUCCESS);

      // Update user's portfolio
      this.logger.debug('Updating user portfolio');
      await this.portfolioService.updatePortfolio(
        userId,
        symbol,
        buyStockDto.quantity,
      );

      // Return the updated trade
      this.logger.debug('Retrieving final trade record for response');
      const updatedTrade = await this.tradeRepository.findOne({
        where: { id: trade.id },
      });

      if (!updatedTrade) {
        throw new NotFoundException(`Trade with ID ${trade.id} not found`);
      }

      this.logger.debug('Trade process completed successfully');
      return this.mapToTradeResponseDto(updatedTrade);
    } catch (error) {
      // If the trade status hasn't been updated yet, update it now
      this.logger.debug('Processing error in trade execution');
      const currentTrade = await this.tradeRepository.findOne({
        where: { id: trade.id },
      });

      if (currentTrade && currentTrade.status === TradeStatus.PENDING) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await this.updateTradeStatus(
          trade.id,
          TradeStatus.FAILED,
          errorMessage,
        );
      }

      throw error;
    }
  }

  /**
   * Check if the provided price is within tolerance of the current price
   */
  private isPriceWithinTolerance(
    providedPrice: number,
    currentPrice: number,
  ): boolean {
    const lowerBound = currentPrice * (1 - this.priceTolerancePercent / 100);
    const upperBound = currentPrice * (1 + this.priceTolerancePercent / 100);

    return providedPrice >= lowerBound && providedPrice <= upperBound;
  }

  /**
   * Update a trade's status and optionally set a reason for failure
   */
  private async updateTradeStatus(
    tradeId: string,
    status: TradeStatus,
    reason?: string,
  ): Promise<void> {
    await this.tradeRepository.update(tradeId, {
      status,
      reason: reason || undefined,
    });
  }

  /**
   * Map Trade entity to TradeResponseDto
   */
  private mapToTradeResponseDto(trade: Trade): TradeResponseDto {
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    return {
      id: trade.id,
      userId: trade.userId,
      symbol: trade.symbol,
      price: trade.price,
      quantity: trade.quantity,
      status: trade.status,
      timestamp: trade.timestamp,
      reason: trade.reason,
    };
  }
}
