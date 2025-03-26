import {
  Controller,
  Post,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ReportService } from './reports.service';
import { ReportScheduler } from './report-scheduler.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportService: ReportService,
    private readonly reportScheduler: ReportScheduler,
  ) {}

  @ApiOperation({ summary: 'Generate a daily report manually' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description:
      'Number of days ago to generate the report for (default: 1 = yesterday)',
  })
  @ApiResponse({
    status: 200,
    description: 'Report generation triggered successfully',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to trigger report generation',
  })
  @Post('generate')
  async generateReport(
    @Query('days', new DefaultValuePipe(1), ParseIntPipe) days: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Calculate the date for the report
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);

      // Trigger the report generation
      await this.reportScheduler.triggerDailyReport(targetDate);

      return {
        success: true,
        message: `Report generation for ${days} day(s) ago has been triggered. Check the queue for processing.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger report generation: ${(error as Error).message}`,
      };
    }
  }

  @ApiOperation({
    summary: 'Generate a daily report synchronously (for testing)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description:
      'Number of days ago to generate the report for (default: 1 = yesterday)',
  })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  @ApiResponse({ status: 500, description: 'Failed to generate report' })
  @Get('generate-sync')
  async generateSyncReport(
    @Query('days', new DefaultValuePipe(1), ParseIntPipe) days: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Calculate the date for the report
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);

      // Generate the report synchronously
      const success = await this.reportService.generateDailyReport(targetDate);

      if (success) {
        return {
          success: true,
          message: `Report for ${days} day(s) ago was generated and sent successfully.`,
        };
      } else {
        return {
          success: false,
          message: 'Report generation completed but failed to send email.',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate report: ${(error as Error).message}`,
      };
    }
  }
}
