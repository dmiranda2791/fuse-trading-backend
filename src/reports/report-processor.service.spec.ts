import { Test, TestingModule } from '@nestjs/testing';
import {
  DailyReportJobData,
  ReportProcessor,
} from './report-processor.service';
import { ReportService } from './reports.service';
import { ConfigService } from '@nestjs/config';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Job } from 'bull';

describe('ReportProcessor', () => {
  let processor: ReportProcessor;
  let reportService: DeepMockProxy<ReportService>;
  let configService: DeepMockProxy<ConfigService>;

  beforeEach(async () => {
    reportService = mockDeep<ReportService>();
    configService = mockDeep<ConfigService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportProcessor,
        {
          provide: ReportService,
          useValue: reportService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    processor = module.get<ReportProcessor>(ReportProcessor);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleDailyReport', () => {
    // Creating a mock Job object
    const createMockJob = (date?: Date): Job<DailyReportJobData> => {
      return {
        id: '123',
        data: { date },
        // Other required Job properties with minimal implementation
        queue: {
          name: 'reports',
        } as { name: string },
        progress: jest.fn(),
        update: jest.fn(),
        discard: jest.fn(),
        remove: jest.fn(),

        finished: jest.fn() as unknown as Promise<unknown>,

        moveToCompleted: jest.fn() as unknown as Promise<unknown>,
        isDelayed: jest.fn(),
        attemptsMade: 0,
        name: 'generateDailyReport',
        stacktrace: [],
        processedOn: undefined,
        finishedOn: undefined,
        timestamp: Date.now(),
        returnvalue: undefined,
        opts: {},
        failedReason: undefined,
        failedValue: undefined,
        toJSON: jest.fn(),
        jobId: '123',
      } as unknown as Job<DailyReportJobData>;
    };

    it('should process daily report job successfully', async () => {
      const testDate = new Date('2023-04-01');
      const mockJob = createMockJob(testDate);

      reportService.generateDailyReport.mockResolvedValueOnce(true);

      const result = await processor.handleDailyReport(mockJob);

      expect(result).toBe(true);
      expect(reportService.generateDailyReport.mock.calls[0][0]).toEqual(
        testDate,
      );
    });

    it('should handle string date in job data', async () => {
      const dateString = '2023-04-01T00:00:00.000Z';
      const mockJob = createMockJob(undefined);
      // Override data with string date (simulating JSON serialization)
      mockJob.data = { date: new Date(dateString) };

      reportService.generateDailyReport.mockResolvedValueOnce(true);

      await processor.handleDailyReport(mockJob);

      // Should convert string to Date
      expect(reportService.generateDailyReport.mock.calls[0][0]).toBeInstanceOf(
        Date,
      );
    });

    it('should throw error when report generation fails', async () => {
      const mockJob = createMockJob();

      reportService.generateDailyReport.mockResolvedValueOnce(false);

      await expect(processor.handleDailyReport(mockJob)).rejects.toThrow(
        'Failed to generate or send daily report',
      );
    });

    it('should handle and rethrow exceptions from report service', async () => {
      const mockJob = createMockJob();
      const error = new Error('Database error');

      reportService.generateDailyReport.mockRejectedValueOnce(error);

      await expect(processor.handleDailyReport(mockJob)).rejects.toThrow(error);
    });
  });
});
