import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StocksService } from './stocks.service';
import { StocksHttpService } from './stocks-http.service';
import { Stock } from './stock.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('StocksService', () => {
  let service: StocksService;
  let _stocksHttpService: StocksHttpService;
  let _stockRepository: Repository<Stock>;
  let _cacheManager: Cache;

  const mockStocksHttpService = {
    getStocks: jest.fn(),
  };

  const mockStockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StocksService,
        {
          provide: StocksHttpService,
          useValue: mockStocksHttpService,
        },
        {
          provide: getRepositoryToken(Stock),
          useValue: mockStockRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<StocksService>(StocksService);
    _stocksHttpService = module.get<StocksHttpService>(StocksHttpService);
    _stockRepository = module.get<Repository<Stock>>(getRepositoryToken(Stock));
    _cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStockBySymbol', () => {
    it('should return a stock from cache if available', async () => {
      const cachedStock = { symbol: 'AAPL', name: 'Apple Inc.', price: 150.5 };
      mockCacheManager.get.mockResolvedValue(cachedStock);

      const result = await service.getStockBySymbol('AAPL');

      expect(mockCacheManager.get).toHaveBeenCalledWith('stock:AAPL');
      expect(mockStockRepository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(cachedStock);
    });

    it('should return a stock from database if valid and not in cache', async () => {
      // No cache hit
      mockCacheManager.get.mockResolvedValue(null);

      // Database hit with valid lastFetchedAt
      const dbStock = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 150.5,
        lastFetchedAt: new Date(),
      };
      mockStockRepository.findOne.mockResolvedValue(dbStock);

      const result = await service.getStockBySymbol('AAPL');

      expect(mockCacheManager.get).toHaveBeenCalledWith('stock:AAPL');
      expect(mockStockRepository.findOne).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(result).toEqual({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 150.5,
      });
    });

    it('should throw NotFoundException if stock not found', async () => {
      // No cache hit
      mockCacheManager.get.mockResolvedValue(null);

      // No database hit
      mockStockRepository.findOne.mockResolvedValue(null);

      // No stock found in vendor API
      jest
        .spyOn(service, 'fetchStocksFromVendor')
        .mockResolvedValue([
          { symbol: 'MSFT', name: 'Microsoft', price: 300.1 },
        ]);

      await expect(service.getStockBySymbol('AAPL')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStocks', () => {
    it('should fetch stocks with cursor-based pagination', async () => {
      const vendorResponse = {
        items: [
          { symbol: 'AAPL', name: 'Apple Inc.', price: 150.5 },
          { symbol: 'MSFT', name: 'Microsoft', price: 300.1 },
        ],
        nextToken: 'some-token',
      };

      mockStocksHttpService.getStocks.mockResolvedValue(vendorResponse);

      const result = await service.getStocks();

      expect(mockStocksHttpService.getStocks).toHaveBeenCalledWith(undefined);
      expect(mockStockRepository.save).toHaveBeenCalledTimes(2);
      expect(result.items).toHaveLength(2);
      expect(result.nextToken).toBe('some-token');
    });

    it('should handle pagination with nextToken', async () => {
      const nextToken = 'page-2-token';

      const vendorResponse = {
        items: [
          { symbol: 'FB', name: 'Meta', price: 250.75 },
          { symbol: 'AMZN', name: 'Amazon', price: 3200.1 },
        ],
        nextToken: 'page-3-token',
      };

      mockStocksHttpService.getStocks.mockResolvedValue(vendorResponse);

      const result = await service.getStocks(nextToken);

      expect(mockStocksHttpService.getStocks).toHaveBeenCalledWith(nextToken);
      expect(result.items).toHaveLength(2);
      expect(result.nextToken).toBe('page-3-token');
    });
  });
});
