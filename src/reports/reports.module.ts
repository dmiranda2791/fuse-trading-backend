import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '../config/config.module';
import { EmailModule } from '../email/email.module';
import { ReportService } from './reports.service';
import { ReportScheduler } from './report-scheduler.service';
import { ReportProcessor } from './report-processor.service';
import { ReportsController } from './reports.controller';
import { Trade } from '../trades/trade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade]),
    BullModule.registerQueue({
      name: 'reports',
    }),
    ConfigModule,
    EmailModule,
  ],
  controllers: [ReportsController],
  providers: [ReportService, ReportScheduler, ReportProcessor],
  exports: [ReportService],
})
export class ReportsModule {}
