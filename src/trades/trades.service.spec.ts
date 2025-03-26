import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TradesService } from './trades.service';
import { StocksService } from '../stocks/stocks.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { TradesHttpService } from './trades-http.service';
import { Trade, TradeStatus } from './trade.entity';
import { BuyStockDto } from './dto/buy-stock.dto';

// Define a simpler mock repository type
type MockType<T> = {
  [P in keyof T]?: jest.Mock<any>;
};

// Create repository mock factory
const createRepositoryMock = (): MockType<Repository<any>> => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

describe('TradesService', () => {
  let service: TradesService;
  let tradeRepository: MockType<Repository<Trade>>;
  let stocksService: Partial<StocksService>;
  let portfolioService: Partial<PortfolioService>;
  let tradesHttpService: Partial<TradesHttpService>;

  beforeEach(async () => {
    tradeRepository = createRepositoryMock();
    stocksService = {
      getStockBySymbol: jest.fn(),
    };
    portfolioService = {
      updatePortfolio: jest.fn(),
    };
    tradesHttpService = {
      buyStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradesService,
        {
          provide: getRepositoryToken(Trade),
          useValue: tradeRepository,
        },
        {
          provide: StocksService,
          useValue: stocksService,
        },
        {
          provide: PortfolioService,
          useValue: portfolioService,
        },
        {
          provide: TradesHttpService,
          useValue: tradesHttpService,
        },
      ],
    }).compile();

    service = module.get<TradesService>(TradesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buyStock', () => {
    it('should successfully buy a stock when price is within range', async () => {
      // Arrange
      const userId = 'user-123';
      const symbol = 'AAPL';
      const buyStockDto: BuyStockDto = {
        price: 150,
        quantity: 5,
      };

      const mockTrade = {
        id: 'trade-123',
        userId,
        symbol,
        price: buyStockDto.price,
        quantity: buyStockDto.quantity,
        status: TradeStatus.PENDING,
        timestamp: new Date(),
      } as Trade;

      const mockSuccessResponse = {
        status: 200,
        success: true,
        message: 'Trade executed successfully',
      };

      tradeRepository.create!.mockReturnValue(mockTrade);
      tradeRepository.save!.mockResolvedValue(mockTrade);
      tradeRepository.findOne!.mockResolvedValue({
        ...mockTrade,
        status: TradeStatus.SUCCESS,
      });

      stocksService.getStockBySymbol = jest.fn().mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        price: 150, // Same price, so it's within range
      });

      tradesHttpService.buyStock = jest
        .fn()
        .mockResolvedValue(mockSuccessResponse);
      portfolioService.updatePortfolio = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await service.buyStock(userId, symbol, buyStockDto);

      // Assert
      expect(tradeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          symbol,
          price: buyStockDto.price,
          quantity: buyStockDto.quantity,
          status: TradeStatus.PENDING,
        }),
      );
      expect(stocksService.getStockBySymbol).toHaveBeenCalledWith(symbol);
      expect(tradesHttpService.buyStock).toHaveBeenCalledWith(
        symbol,
        buyStockDto,
      );
      expect(tradeRepository.update).toHaveBeenCalledWith(
        mockTrade.id,
        expect.objectContaining({ status: TradeStatus.SUCCESS }),
      );
      expect(portfolioService.updatePortfolio).toHaveBeenCalledWith(
        userId,
        symbol,
        buyStockDto.quantity,
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: mockTrade.id,
          userId,
          symbol,
          price: buyStockDto.price,
          quantity: buyStockDto.quantity,
          status: TradeStatus.SUCCESS,
        }),
      );
    });

    it('should throw BadRequestException when price is out of range', async () => {
      // Arrange
      const userId = 'user-123';
      const symbol = 'AAPL';
      const currentPrice = 150;
      const buyStockDto: BuyStockDto = {
        price: 140, // Way below current price (more than 2% difference)
        quantity: 5,
      };

      const mockTrade = {
        id: 'trade-123',
        userId,
        symbol,
        price: buyStockDto.price,
        quantity: buyStockDto.quantity,
        status: TradeStatus.PENDING,
        timestamp: new Date(),
      } as Trade;

      tradeRepository.create!.mockReturnValue(mockTrade);
      tradeRepository.save!.mockResolvedValue(mockTrade);

      stocksService.getStockBySymbol = jest.fn().mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        price: currentPrice,
      });

      // Act & Assert
      await expect(
        service.buyStock(userId, symbol, buyStockDto),
      ).rejects.toThrow(BadRequestException);
      expect(tradeRepository.update).toHaveBeenCalledWith(
        mockTrade.id,
        expect.objectContaining({ status: TradeStatus.FAILED }),
      );
      expect(tradesHttpService.buyStock).not.toHaveBeenCalled();
      expect(portfolioService.updatePortfolio).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when vendor API reports failure', async () => {
      // Arrange
      const userId = 'user-123';
      const symbol = 'AAPL';
      const buyStockDto: BuyStockDto = {
        price: 150,
        quantity: 5,
      };

      const mockTrade = {
        id: 'trade-123',
        userId,
        symbol,
        price: buyStockDto.price,
        quantity: buyStockDto.quantity,
        status: TradeStatus.PENDING,
        timestamp: new Date(),
      } as Trade;

      const mockFailedResponse = {
        status: 400,
        success: false,
        message: 'Vendor API error',
      };

      tradeRepository.create!.mockReturnValue(mockTrade);
      tradeRepository.save!.mockResolvedValue(mockTrade);

      stocksService.getStockBySymbol = jest.fn().mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        price: 150,
      });

      tradesHttpService.buyStock = jest
        .fn()
        .mockResolvedValue(mockFailedResponse);

      // Act & Assert
      await expect(
        service.buyStock(userId, symbol, buyStockDto),
      ).rejects.toThrow(BadRequestException);
      expect(tradeRepository.update).toHaveBeenCalledWith(
        mockTrade.id,
        expect.objectContaining({
          status: TradeStatus.FAILED,
          reason: mockFailedResponse.message,
        }),
      );
      expect(portfolioService.updatePortfolio).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when updated trade is not found', async () => {
      // Arrange
      const userId = 'user-123';
      const symbol = 'AAPL';
      const buyStockDto: BuyStockDto = {
        price: 150,
        quantity: 5,
      };

      const mockTrade = {
        id: 'trade-123',
        userId,
        symbol,
        price: buyStockDto.price,
        quantity: buyStockDto.quantity,
        status: TradeStatus.PENDING,
        timestamp: new Date(),
      } as Trade;

      const mockSuccessResponse = {
        status: 200,
        success: true,
        message: 'Trade executed successfully',
      };

      tradeRepository.create!.mockReturnValue(mockTrade);
      tradeRepository.save!.mockResolvedValue(mockTrade);
      // Simulate updated trade not found
      tradeRepository.findOne!.mockResolvedValue(null);

      stocksService.getStockBySymbol = jest.fn().mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        price: 150,
      });

      tradesHttpService.buyStock = jest
        .fn()
        .mockResolvedValue(mockSuccessResponse);
      portfolioService.updatePortfolio = jest.fn().mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        service.buyStock(userId, symbol, buyStockDto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
