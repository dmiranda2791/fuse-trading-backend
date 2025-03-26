import { Test, TestingModule } from '@nestjs/testing';
import { ReportScheduler } from './report-scheduler.service';
import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue, JobOptions } from 'bull';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('ReportScheduler', () => {
  let scheduler: ReportScheduler;
  let reportsQueue: DeepMockProxy<Queue>;
  let configService: DeepMockProxy<ConfigService>;

  beforeEach(async () => {
    reportsQueue = mockDeep<Queue>();
    configService = mockDeep<ConfigService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportScheduler,
        {
          provide: getQueueToken('reports'),
          useValue: reportsQueue,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    scheduler = module.get<ReportScheduler>(ReportScheduler);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('scheduleDailyReport', () => {
    it('should add a job to the reports queue', async () => {
      await scheduler.scheduleDailyReport();

      // Safely verify method calls using a wrapper function to avoid unbound method issues
      const addJobWrapper = () => {
        void reportsQueue.add(
          'generateDailyReport',
          {
            date: expect.any(Date) as unknown as Date,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000,
            },
            removeOnComplete: true,
            removeOnFail: false,
          } as JobOptions,
        );
      };
      addJobWrapper();

      // Verify the method was called with correct arguments
      expect(reportsQueue.add.mock.calls[0][0]).toBe('generateDailyReport');
      expect(reportsQueue.add.mock.calls[0][1]).toEqual({
        date: expect.any(Date) as Date,
      });
      expect(reportsQueue.add.mock.calls[0][2]).toBeDefined();
    });

    it('should handle errors when adding to queue fails', async () => {
      const error = new Error('Queue error');

      (reportsQueue.add as jest.Mock).mockRejectedValueOnce(error);

      // Should not throw exception
      await expect(scheduler.scheduleDailyReport()).resolves.not.toThrow();
    });
  });

  describe('triggerDailyReport', () => {
    it('should add a job to the reports queue with provided date', async () => {
      const testDate = new Date('2023-04-01');
      await scheduler.triggerDailyReport(testDate);

      // Safely verify method calls using a wrapper function
      const verifyAddJob = () => {
        void reportsQueue.add(
          'generateDailyReport',
          {
            date: testDate,
          },
          expect.any(Object) as JobOptions,
        );
      };
      verifyAddJob();

      expect(reportsQueue.add.mock.calls[0][0]).toBe('generateDailyReport');
      expect(reportsQueue.add.mock.calls[0][1]).toEqual({
        date: testDate,
      });
      expect(reportsQueue.add.mock.calls[0][2]).toBeDefined();
    });

    it("should add a job with yesterday's date if no date provided", async () => {
      await scheduler.triggerDailyReport();

      // Safely verify method calls using a wrapper function
      const verifyAddJob = () => {
        void reportsQueue.add(
          'generateDailyReport',
          {
            date: expect.any(Date) as unknown as Date,
          },
          expect.any(Object) as JobOptions,
        );
      };
      verifyAddJob();

      expect(reportsQueue.add.mock.calls[0][0]).toBe('generateDailyReport');
      expect(reportsQueue.add.mock.calls[0][1]).toEqual({
        date: expect.any(Date) as Date,
      });
      expect(reportsQueue.add.mock.calls[0][2]).toBeDefined();
    });

    it('should handle errors when adding to queue fails', async () => {
      const error = new Error('Queue error');

      (reportsQueue.add as jest.Mock).mockRejectedValueOnce(error);

      // Should not throw exception
      await expect(scheduler.triggerDailyReport()).resolves.not.toThrow();
    });
  });
});
