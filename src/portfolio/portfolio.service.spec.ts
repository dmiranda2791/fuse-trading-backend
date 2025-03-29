import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from './portfolio.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Portfolio } from './portfolio.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

// Define the cursor type to match what the service uses
interface PortfolioCursor {
  offset: number;
}

describe('PortfolioService', () => {
  let service: PortfolioService;
  let mockRepository: jest.Mocked<
    Pick<
      Repository<Portfolio>,
      'find' | 'findOne' | 'findAndCount' | 'create' | 'save' | 'remove'
    >
  >;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: getRepositoryToken(Portfolio),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPortfolio', () => {
    it('should return paginated portfolio items', async () => {
      const userId = 'user123';
      const portfolioItems: Portfolio[] = [
        { userId, symbol: 'AAPL', quantity: 10 } as Portfolio,
        { userId, symbol: 'MSFT', quantity: 5 } as Portfolio,
      ];

      mockRepository.findAndCount.mockResolvedValue([portfolioItems, 2]);

      const result = await service.getUserPortfolio(userId);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { symbol: 'ASC' },
        skip: 0,
        take: 11, // pageSize + 1
      });

      expect(result).toEqual({
        items: [
          { userId, symbol: 'AAPL', quantity: 10 },
          { userId, symbol: 'MSFT', quantity: 5 },
        ],
        nextToken: null,
      });
    });

    it('should handle pagination with nextToken', async () => {
      const userId = 'user123';
      const offset = 10;
      const nextToken = Buffer.from(JSON.stringify({ offset })).toString(
        'base64',
      );

      const portfolioItems: Portfolio[] = [
        { userId, symbol: 'NFLX', quantity: 8 } as Portfolio,
        { userId, symbol: 'TSLA', quantity: 3 } as Portfolio,
      ];

      mockRepository.findAndCount.mockResolvedValue([portfolioItems, 12]);

      const result = await service.getUserPortfolio(userId, nextToken);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { symbol: 'ASC' },
        skip: offset,
        take: 11, // pageSize + 1
      });

      expect(result).toEqual({
        items: [
          { userId, symbol: 'NFLX', quantity: 8 },
          { userId, symbol: 'TSLA', quantity: 3 },
        ],
        nextToken: null,
      });
    });

    it('should return nextToken when there are more items', async () => {
      const userId = 'user123';
      // Create 11 items (one more than pageSize)
      const portfolioItems: Portfolio[] = Array(11)
        .fill(null)
        .map(
          (_, i) =>
            ({
              userId,
              symbol: `SYM${i}`,
              quantity: i + 1,
            }) as Portfolio,
        );

      mockRepository.findAndCount.mockResolvedValue([portfolioItems, 11]);

      const result = await service.getUserPortfolio(userId);

      // Only 10 items should be returned
      expect(result.items.length).toBe(10);
      // And there should be a nextToken
      expect(result.nextToken).not.toBeNull();

      // Decode the token to verify it's correct
      const decodedToken = JSON.parse(
        Buffer.from(result.nextToken as string, 'base64').toString('utf-8'),
      ) as PortfolioCursor;
      expect(decodedToken).toEqual({ offset: 10 });
    });

    it('should throw BadRequestException for invalid nextToken', async () => {
      const userId = 'user123';
      const invalidToken = 'not-a-valid-token';

      await expect(
        service.getUserPortfolio(userId, invalidToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user has no holdings', async () => {
      const userId = 'nonexistent';
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

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
      const newHolding = { userId, symbol, quantity } as Portfolio;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(newHolding);

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
    });

    it('should update existing holding if user already has the stock', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const existingQuantity = 5;
      const addQuantity = 10;
      const existingHolding = {
        userId,
        symbol,
        quantity: existingQuantity,
      } as Portfolio;

      mockRepository.findOne.mockResolvedValue(existingHolding);

      await service.updatePortfolio(userId, symbol, addQuantity);

      expect(existingHolding.quantity).toBe(existingQuantity + addQuantity);
      expect(mockRepository.save).toHaveBeenCalledWith(existingHolding);
    });

    it('should remove holding if quantity becomes zero or negative', async () => {
      const userId = 'user123';
      const symbol = 'AAPL';
      const existingQuantity = 5;
      const subtractQuantity = -5; // This will make total 0
      const existingHolding = {
        userId,
        symbol,
        quantity: existingQuantity,
      } as Portfolio;

      mockRepository.findOne.mockResolvedValue(existingHolding);

      await service.updatePortfolio(userId, symbol, subtractQuantity);

      expect(existingHolding.quantity).toBe(0);
      expect(mockRepository.remove).toHaveBeenCalledWith(existingHolding);
    });
  });
});
