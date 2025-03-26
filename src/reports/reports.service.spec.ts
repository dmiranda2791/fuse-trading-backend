import { Test, TestingModule } from '@nestjs/testing';
import { ReportService, TradeReportData } from './reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Trade, TradeStatus } from '../trades/trade.entity';
import { EmailService } from '../email/email.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { format } from 'date-fns';

describe('ReportService', () => {
  let service: ReportService;
  let tradeRepository: DeepMockProxy<Repository<Trade>>;
  let emailService: DeepMockProxy<EmailService>;

  const mockedDate = new Date('2023-04-01');
  const formattedDate = format(mockedDate, 'yyyy-MM-dd');

  const mockTrades: Trade[] = [
    {
      id: '1',
      userId: 'user1',
      symbol: 'AAPL',
      price: 150.5,
      quantity: 10,
      status: TradeStatus.SUCCESS,
      timestamp: new Date('2023-04-01T10:30:00.000Z'),
      reason: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      userId: 'user1',
      symbol: 'MSFT',
      price: 240.75,
      quantity: 5,
      status: TradeStatus.FAILED,
      timestamp: new Date('2023-04-01T11:15:00.000Z'),
      reason: 'Price out of range',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      userId: 'user2',
      symbol: 'GOOGL',
      price: 2500.0,
      quantity: 2,
      status: TradeStatus.SUCCESS,
      timestamp: new Date('2023-04-01T14:45:00.000Z'),
      reason: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '4',
      userId: 'user2',
      symbol: 'AMZN',
      price: 3200.0,
      quantity: 1,
      status: TradeStatus.FAILED,
      timestamp: new Date('2023-04-01T16:20:00.000Z'),
      reason: 'Insufficient funds',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '5',
      userId: 'user1',
      symbol: 'TSLA',
      price: 800.25,
      quantity: 3,
      status: TradeStatus.FAILED,
      timestamp: new Date('2023-04-01T17:10:00.000Z'),
      reason: 'Price out of range',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const _mockFormattedTrades: TradeReportData[] = mockTrades.map(trade => ({
    userId: trade.userId,
    symbol: trade.symbol,
    price: Number(trade.price),
    quantity: trade.quantity,
    status: trade.status,
    timestamp: format(trade.timestamp, 'yyyy-MM-dd HH:mm:ss'),
  }));

  const mockRecipients = ['admin@example.com'];
  const mockHtmlContent = '<h1>Daily Report</h1><p>Some content</p>';

  beforeEach(async () => {
    tradeRepository = mockDeep<Repository<Trade>>();
    emailService = mockDeep<EmailService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getRepositoryToken(Trade),
          useValue: tradeRepository,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDailyReport', () => {
    beforeEach(() => {
      tradeRepository.find.mockResolvedValue(mockTrades);
      emailService.getDefaultRecipients.mockReturnValue(mockRecipients);
      emailService.renderTemplate.mockResolvedValue(mockHtmlContent);
      emailService.sendEmail.mockResolvedValue(true);
    });

    it('should generate and send daily report successfully', async () => {
      const result = await service.generateDailyReport(mockedDate);

      expect(result).toBe(true);

      expect(tradeRepository.find.mock.calls[0][0]).toEqual({
        where: {
          timestamp: Between(expect.any(Date), expect.any(Date)),
        },
        order: {
          timestamp: 'DESC',
        },
      });

      // Check emailService.renderTemplate call
      expect(emailService.renderTemplate.mock.calls[0][0]).toBe('daily-report');
      const templateContext = emailService.renderTemplate.mock.calls[0][1];
      expect(templateContext).toHaveProperty('reportDate');
      expect(templateContext).toHaveProperty('totalTrades', 5);
      expect(templateContext).toHaveProperty('successCount', 2);
      expect(templateContext).toHaveProperty('failedCount', 3);

      // Check emailService.sendEmail call
      expect(emailService.sendEmail.mock.calls[0][0]).toEqual({
        to: mockRecipients,
        subject: `Fuse Daily Trade Report - ${formattedDate}`,
        html: mockHtmlContent,
      });
    });

    it('should handle case when no trades found', async () => {
      (tradeRepository.find as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.generateDailyReport(mockedDate);

      expect(result).toBe(true);
      expect(emailService.renderTemplate.mock.calls.length).toBe(0);
      expect(emailService.sendEmail.mock.calls.length).toBe(0);
    });

    it('should handle case when no email recipients configured', async () => {
      (emailService.getDefaultRecipients as jest.Mock).mockReturnValueOnce([]);

      const result = await service.generateDailyReport(mockedDate);

      expect(result).toBe(false);
      expect(emailService.sendEmail.mock.calls.length).toBe(0);
    });

    it('should handle email sending failure', async () => {
      (emailService.sendEmail as jest.Mock).mockResolvedValueOnce(false);

      const result = await service.generateDailyReport(mockedDate);

      expect(result).toBe(false);
    });

    it('should handle exceptions during report generation', async () => {
      (tradeRepository.find as jest.Mock).mockRejectedValueOnce(
        new Error('Database error'),
      );

      const result = await service.generateDailyReport(mockedDate);

      expect(result).toBe(false);
    });
  });

  describe('aggregateFailureReasons', () => {
    it('should correctly aggregate failure reasons', () => {
      // Use private method testing technique with type casting
      const aggregateMethod = (
        service as unknown as {
          aggregateFailureReasons: (
            trades: Trade[],
          ) => { reason: string; count: number }[];
        }
      ).aggregateFailureReasons;

      // Filter failed trades
      const failedTrades = mockTrades.filter(
        trade => trade.status === TradeStatus.FAILED,
      );

      const result = aggregateMethod.call(service, failedTrades);

      expect(result).toEqual([
        { reason: 'Price out of range', count: 2 },
        { reason: 'Insufficient funds', count: 1 },
      ]);
    });
  });
});
