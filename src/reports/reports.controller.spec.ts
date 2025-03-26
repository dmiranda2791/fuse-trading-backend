import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportService } from './reports.service';
import { ReportScheduler } from './report-scheduler.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportService: DeepMockProxy<ReportService>;
  let reportScheduler: DeepMockProxy<ReportScheduler>;

  beforeEach(async () => {
    reportService = mockDeep<ReportService>();
    reportScheduler = mockDeep<ReportScheduler>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportService,
          useValue: reportService,
        },
        {
          provide: ReportScheduler,
          useValue: reportScheduler,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateReport', () => {
    it('should trigger report generation for specified days ago', async () => {
      const days = 2;

      const result = await controller.generateReport(days);

      expect(result.success).toBe(true);
      expect(
        reportScheduler.triggerDailyReport.mock.calls[0][0],
      ).toBeInstanceOf(Date);
    });

    it('should handle errors during report scheduling', async () => {
      const days = 1;
      const error = new Error('Scheduling error');

      reportScheduler.triggerDailyReport.mockRejectedValueOnce(error);

      const result = await controller.generateReport(days);

      expect(result.success).toBe(false);
      expect(result.message).toContain(error.message);
    });
  });

  describe('generateSyncReport', () => {
    it('should generate report synchronously when successful', async () => {
      const days = 3;

      reportService.generateDailyReport.mockResolvedValueOnce(true);

      const result = await controller.generateSyncReport(days);

      expect(result.success).toBe(true);
      expect(reportService.generateDailyReport.mock.calls[0][0]).toBeInstanceOf(
        Date,
      );
    });

    it('should handle unsuccessful report generation', async () => {
      const days = 1;

      reportService.generateDailyReport.mockResolvedValueOnce(false);

      const result = await controller.generateSyncReport(days);

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed to send email');
    });

    it('should handle errors during report generation', async () => {
      const days = 1;
      const error = new Error('Generation error');

      reportService.generateDailyReport.mockRejectedValueOnce(error);

      const result = await controller.generateSyncReport(days);

      expect(result.success).toBe(false);
      expect(result.message).toContain(error.message);
    });
  });
});
