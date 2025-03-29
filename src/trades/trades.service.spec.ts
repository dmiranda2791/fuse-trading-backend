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

describe('TradesService', () => {
  let service: TradesService;
  let tradeRepository: jest.Mocked<
    Pick<Repository<Trade>, 'create' | 'save' | 'findOne' | 'update'>
  >;
  let stocksService: jest.Mocked<Pick<StocksService, 'getStockBySymbol'>>;
  let portfolioService: jest.Mocked<Pick<PortfolioService, 'updatePortfolio'>>;
  let tradesHttpService: jest.Mocked<Pick<TradesHttpService, 'buyStock'>>;

  beforeEach(async () => {
    tradeRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

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

      tradeRepository.create.mockReturnValue(mockTrade);
      tradeRepository.save.mockResolvedValue(mockTrade);
      tradeRepository.findOne.mockResolvedValue({
        ...mockTrade,
        status: TradeStatus.SUCCESS,
      } as Trade);

      stocksService.getStockBySymbol.mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        price: 150, // Same price, so it's within range
      });

      tradesHttpService.buyStock.mockResolvedValue(mockSuccessResponse);
      portfolioService.updatePortfolio.mockResolvedValue(undefined);

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

      tradeRepository.create.mockReturnValue(mockTrade);
      tradeRepository.save.mockResolvedValue(mockTrade);

      stocksService.getStockBySymbol.mockResolvedValue({
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

      tradeRepository.create.mockReturnValue(mockTrade);
      tradeRepository.save.mockResolvedValue(mockTrade);

      stocksService.getStockBySymbol.mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        price: 150,
      });

      tradesHttpService.buyStock.mockResolvedValue(mockFailedResponse);

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

      tradeRepository.create.mockReturnValue(mockTrade);
      tradeRepository.save.mockResolvedValue(mockTrade);
      // Return null to simulate trade not found
      tradeRepository.findOne.mockResolvedValue(null);

      stocksService.getStockBySymbol.mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        price: 150,
      });

      tradesHttpService.buyStock.mockResolvedValue(mockSuccessResponse);

      // Act & Assert
      await expect(
        service.buyStock(userId, symbol, buyStockDto),
      ).rejects.toThrow(NotFoundException);
      expect(tradeRepository.update).toHaveBeenCalledWith(
        mockTrade.id,
        expect.objectContaining({ status: TradeStatus.SUCCESS }),
      );
      expect(portfolioService.updatePortfolio).toHaveBeenCalled();
    });

    it('should handle unexpected errors during trade execution', async () => {
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

      tradeRepository.create.mockReturnValue(mockTrade);
      tradeRepository.save.mockResolvedValue(mockTrade);
      tradeRepository.findOne.mockResolvedValueOnce({
        ...mockTrade,
        status: TradeStatus.PENDING,
      } as Trade);

      // Simulate an unexpected error in the API
      stocksService.getStockBySymbol.mockRejectedValue(
        new Error('Unexpected error'),
      );

      // Act & Assert
      await expect(
        service.buyStock(userId, symbol, buyStockDto),
      ).rejects.toThrow('Unexpected error');
      expect(tradeRepository.update).toHaveBeenCalledWith(
        mockTrade.id,
        expect.objectContaining({
          status: TradeStatus.FAILED,
          reason: 'Unexpected error',
        }),
      );
    });
  });
});
