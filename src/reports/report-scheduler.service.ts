import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReportScheduler {
  private readonly logger = new Logger(ReportScheduler.name);

  constructor(
    @InjectQueue('reports') private readonly reportsQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('Report scheduler initialized');
  }

  // Run daily at midnight (server time)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleDailyReport(): Promise<void> {
    this.logger.log('Scheduling daily report');

    try {
      // Queue the report job
      await this.reportsQueue.add(
        'generateDailyReport',
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute initial delay
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log('Daily report job queued successfully');
    } catch (error) {
      this.logger.error(
        `Failed to queue daily report job: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  // Optional method to manually trigger a report for testing
  async triggerDailyReport(date?: Date): Promise<void> {
    this.logger.log(
      `Manually triggering daily report for ${date ? date.toISOString() : 'yesterday'}`,
    );

    try {
      await this.reportsQueue.add(
        'generateDailyReport',
        {
          date: date || new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday if no date is provided
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute initial delay
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log('Manual report job queued successfully');
    } catch (error) {
      this.logger.error(
        `Failed to queue manual report job: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
