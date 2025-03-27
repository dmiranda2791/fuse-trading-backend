import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PortfolioItemDto } from './dto/portfolio.dto';
import { CursorPaginatedResponseDto } from '../common/dto/pagination.dto';

describe('PortfolioController', () => {
  let controller: PortfolioController;
  let service: PortfolioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [
        {
          provide: PortfolioService,
          useValue: {
            getUserPortfolio: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PortfolioController>(PortfolioController);
    service = module.get<PortfolioService>(PortfolioService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPortfolio', () => {
    it('should return a user portfolio when it exists', async () => {
      const userId = 'user123';
      const mockPortfolio: CursorPaginatedResponseDto<PortfolioItemDto> = {
        items: [
          { userId, symbol: 'AAPL', quantity: 10 },
          { userId, symbol: 'MSFT', quantity: 5 },
        ],
        nextToken: null, // No more pages
      };

      const getUserPortfolioSpy = jest
        .spyOn(service, 'getUserPortfolio')
        .mockResolvedValue(mockPortfolio);

      expect(await controller.getPortfolio(userId)).toBe(mockPortfolio);
      expect(getUserPortfolioSpy).toHaveBeenCalledWith(userId, undefined);
    });

    it('should throw NotFoundException when portfolio does not exist', async () => {
      const userId = 'nonexistent';
      const getUserPortfolioSpy = jest
        .spyOn(service, 'getUserPortfolio')
        .mockRejectedValue(
          new NotFoundException(`Portfolio not found for user ${userId}`),
        );

      await expect(controller.getPortfolio(userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(getUserPortfolioSpy).toHaveBeenCalledWith(userId, undefined);
    });

    it('should propagate other errors', async () => {
      const userId = 'user123';
      const error = new Error('Database connection error');

      const getUserPortfolioSpy = jest
        .spyOn(service, 'getUserPortfolio')
        .mockRejectedValue(error);

      await expect(controller.getPortfolio(userId)).rejects.toThrow(error);
      expect(getUserPortfolioSpy).toHaveBeenCalledWith(userId, undefined);
    });
  });
});
