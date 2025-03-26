import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from './portfolio.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Portfolio } from './portfolio.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';

type MockType<T> = {
  [P in keyof T]?: jest.Mock<any, any>;
};

describe('PortfolioService', () => {
  let service: PortfolioService;
  let mockRepository: MockType<Repository<Portfolio>>;
  let mockCacheManager: MockType<Cache>;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: getRepositoryToken(Portfolio),
          useValue: mockRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPortfolio', () => {
    it('should return cached portfolio if available', async () => {
      const cachedPortfolio = {
        userId: 'user123',
        holdings: [{ symbol: 'AAPL', quantity: 10 }],
        totalStocks: 1,
        totalShares: 10,
      };
      mockCacheManager.get!.mockResolvedValue(cachedPortfolio);

      const result = await service.getUserPortfolio('user123');

      expect(mockCacheManager.get).toHaveBeenCalledWith('portfolio:user123');
      expect(mockRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual(cachedPortfolio);
    });

    it('should fetch portfolio from database and cache it if not cached', async () => {
      const userId = 'user123';
      const holdings = [
        { userId, symbol: 'AAPL', quantity: 10 },
        { userId, symbol: 'MSFT', quantity: 5 },
      ];

      mockCacheManager.get!.mockResolvedValue(null);
      mockRepository.find!.mockResolvedValue(holdings);

      const expectedResponse = {
        userId,
        holdings: [
          { symbol: 'AAPL', quantity: 10 },
          { symbol: 'MSFT', quantity: 5 },
        ],
        totalStocks: 2,
        totalShares: 15,
      };

      const result = await service.getUserPortfolio(userId);

      expect(mockCacheManager.get).toHaveBeenCalledWith(`portfolio:${userId}`);
      expect(mockRepository.find).toHaveBeenCalledWith({ where: { userId } });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `portfolio:${userId}`,
        expectedResponse,
        15 * 60 * 1000,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException if user has no holdings', async () => {
      const userId = 'nonexistent';
      mockCacheManager.get!.mockResolvedValue(null);
      mockRepository.find!.mockResolvedValue([]);

      await expect(service.getUserPortfolio(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePortfolio', () => {
    it('should create new holding if user does not have the stock', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const quantity = 10;
      const newHolding = { userId, symbol, quantity };

      mockRepository.findOne!.mockResolvedValue(null);
      mockRepository.create!.mockReturnValue(newHolding);

      await service.updatePortfolio(userId, symbol, quantity);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { userId, symbol },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        symbol,
        quantity,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newHolding);
      expect(mockCacheManager.del).toHaveBeenCalledWith(`portfolio:${userId}`);
    });

    it('should update existing holding if user already has the stock', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const existingQuantity = 5;
      const addQuantity = 10;
      const existingHolding = { userId, symbol, quantity: existingQuantity };

      mockRepository.findOne!.mockResolvedValue(existingHolding);

      await service.updatePortfolio(userId, symbol, addQuantity);

      expect(existingHolding.quantity).toBe(existingQuantity + addQuantity);
      expect(mockRepository.save).toHaveBeenCalledWith(existingHolding);
      expect(mockCacheManager.del).toHaveBeenCalledWith(`portfolio:${userId}`);
    });

    it('should remove holding if quantity becomes zero or negative', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const existingQuantity = 5;
      const subtractQuantity = -5; // This will make total 0
      const existingHolding = { userId, symbol, quantity: existingQuantity };

      mockRepository.findOne!.mockResolvedValue(existingHolding);

      await service.updatePortfolio(userId, symbol, subtractQuantity);

      expect(existingHolding.quantity).toBe(0);
      expect(mockRepository.remove).toHaveBeenCalledWith(existingHolding);
      expect(mockCacheManager.del).toHaveBeenCalledWith(`portfolio:${userId}`);
    });
  });
});
