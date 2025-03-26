import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { ReportService } from './reports.service';

interface DailyReportJobData {
  date?: Date;
}

@Injectable()
@Processor('reports')
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly configService: ConfigService,
  ) {}

  @Process('generateDailyReport')
  async handleDailyReport(job: Job<DailyReportJobData>): Promise<boolean> {
    this.logger.log(`Processing daily report job ${job.id}`);

    try {
      // Extract the date from the job data or use yesterday
      let reportDate = job.data.date;

      // If the date is a string (from JSON serialization), convert it back to Date
      if (reportDate && typeof reportDate === 'string') {
        reportDate = new Date(reportDate);
      }

      // Generate and send the report
      const success = await this.reportService.generateDailyReport(reportDate);

      if (success) {
        this.logger.log(
          `Successfully generated and sent daily report for job ${job.id}`,
        );
      } else {
        this.logger.warn(
          `Failed to generate or send daily report for job ${job.id}`,
        );
        throw new Error('Failed to generate or send daily report');
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Error processing daily report job ${job.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
