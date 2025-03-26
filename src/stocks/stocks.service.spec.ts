import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StocksService } from './stocks.service';
import { StocksHttpService } from './stocks-http.service';
import { PaginationService } from './pagination.service';
import { Stock } from './stock.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('StocksService', () => {
  let service: StocksService;
  let stocksHttpService: StocksHttpService;
  let paginationService: PaginationService;
  let stockRepository: Repository<Stock>;
  let cacheManager: any;

  const mockStocksHttpService = {
    getStocks: jest.fn(),
  };

  const mockPaginationService = {
    getToken: jest.fn(),
    storeToken: jest.fn(),
    createPaginationResponse: jest.fn(),
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
          provide: PaginationService,
          useValue: mockPaginationService,
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
    stocksHttpService = module.get<StocksHttpService>(StocksHttpService);
    paginationService = module.get<PaginationService>(PaginationService);
    stockRepository = module.get<Repository<Stock>>(getRepositoryToken(Stock));
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStockBySymbol', () => {
    it('should return a stock from cache if available', async () => {
      const cachedStock = { symbol: 'AAPL', name: 'Apple Inc.', price: 150.50 };
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
        price: 150.50,
        lastFetchedAt: new Date(),
      };
      mockStockRepository.findOne.mockResolvedValue(dbStock);

      const result = await service.getStockBySymbol('AAPL');

      expect(mockCacheManager.get).toHaveBeenCalledWith('stock:AAPL');
      expect(mockStockRepository.findOne).toHaveBeenCalledWith({ where: { symbol: 'AAPL' } });
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(result).toEqual({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 150.50,
      });
    });

    it('should throw NotFoundException if stock not found', async () => {
      // No cache hit
      mockCacheManager.get.mockResolvedValue(null);

      // No database hit
      mockStockRepository.findOne.mockResolvedValue(null);

      // No stock found in vendor API
      jest.spyOn(service as any, 'fetchStocksFromVendor').mockResolvedValue([
        { symbol: 'MSFT', name: 'Microsoft', price: 300.10 },
      ]);

      await expect(service.getStockBySymbol('AAPL')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStocks', () => {
    it('should fetch stocks with pagination', async () => {
      const vendorResponse = {
        items: [
          { symbol: 'AAPL', name: 'Apple Inc.', price: 150.50 },
          { symbol: 'MSFT', name: 'Microsoft', price: 300.10 },
        ],
        nextToken: 'some-token',
      };

      mockPaginationService.getToken.mockResolvedValue(null);
      mockStocksHttpService.getStocks.mockResolvedValue(vendorResponse);
      mockPaginationService.createPaginationResponse.mockReturnValue({
        items: vendorResponse.items,
        page: 1,
        limit: 25,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: true,
        hasPreviousPage: false,
      });

      const result = await service.getStocks(1, 25);

      expect(mockPaginationService.getToken).toHaveBeenCalledWith(1);
      expect(mockStocksHttpService.getStocks).toHaveBeenCalledWith(undefined);
      expect(mockPaginationService.storeToken).toHaveBeenCalledWith(1, 'some-token');
      expect(mockStockRepository.save).toHaveBeenCalledTimes(2);
      expect(mockPaginationService.createPaginationResponse).toHaveBeenCalled();
      expect(result.items).toEqual(vendorResponse.items);
    });

    it('should handle pagination for pages beyond the first', async () => {
      const pageToken = 'page-2-token';
      mockPaginationService.getToken.mockResolvedValue(pageToken);

      const vendorResponse = {
        items: [
          { symbol: 'FB', name: 'Meta', price: 250.75 },
          { symbol: 'AMZN', name: 'Amazon', price: 3200.10 },
        ],
        nextToken: 'page-3-token',
      };

      mockStocksHttpService.getStocks.mockResolvedValue(vendorResponse);
      mockPaginationService.createPaginationResponse.mockReturnValue({
        items: vendorResponse.items,
        page: 2,
        limit: 25,
        totalItems: 52,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });

      const result = await service.getStocks(2, 25);

      expect(mockPaginationService.getToken).toHaveBeenCalledWith(2);
      expect(mockStocksHttpService.getStocks).toHaveBeenCalledWith(pageToken);
      expect(mockPaginationService.storeToken).toHaveBeenCalledWith(2, 'page-3-token');
      expect(result.page).toBe(2);
    });
  });
}); 