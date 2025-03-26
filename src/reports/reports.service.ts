import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Trade, TradeStatus } from '../trades/trade.entity';
import { EmailService } from '../email/email.service';
import { format } from 'date-fns';

export interface TradeReportData {
  userId: string;
  symbol: string;
  price: number;
  quantity: number;
  status: string;
  timestamp: string;
}

export interface FailureReason {
  reason: string;
  count: number;
}

export interface DailyReportContext {
  reportDate: string;
  totalTrades: number;
  successCount: number;
  failedCount: number;
  failureReasons: FailureReason[];
  trades: TradeReportData[];
  currentYear: number;
  [key: string]: unknown;
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly emailService: EmailService,
  ) {}

  async generateDailyReport(date?: Date): Promise<boolean> {
    this.logger.log('Generating daily report');

    // If no date is provided, use yesterday
    const reportDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get start and end of the day
    const startDate = new Date(reportDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(reportDate);
    endDate.setHours(23, 59, 59, 999);

    try {
      // Get trades from the specified day
      const trades = await this.tradeRepository.find({
        where: {
          timestamp: Between(startDate, endDate),
        },
        order: {
          timestamp: 'DESC',
        },
      });

      if (trades.length === 0) {
        this.logger.log(
          `No trades found for ${format(reportDate, 'yyyy-MM-dd')}`,
        );
        return true; // No trades to report is not a failure
      }

      const successfulTrades = trades.filter(
        trade => trade.status === TradeStatus.SUCCESS,
      );

      const failedTrades = trades.filter(
        trade => trade.status === TradeStatus.FAILED,
      );

      // Calculate failure reasons
      const failureReasons: FailureReason[] =
        this.aggregateFailureReasons(failedTrades);

      // Format trades for display
      const formattedTrades: TradeReportData[] = trades.map(trade => ({
        userId: trade.userId,
        symbol: trade.symbol,
        price: Number(trade.price), // Convert decimal type from DB to number
        quantity: trade.quantity,
        status: trade.status,
        timestamp: format(trade.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      }));

      // Build the report context
      const reportContext: DailyReportContext = {
        reportDate: format(reportDate, 'yyyy-MM-dd'),
        totalTrades: trades.length,
        successCount: successfulTrades.length,
        failedCount: failedTrades.length,
        failureReasons,
        trades: formattedTrades,
        currentYear: new Date().getFullYear(),
      };

      // Render the email template with the report context
      const htmlContent = await this.emailService.renderTemplate(
        'daily-report',
        reportContext,
      );

      // Send the email
      const recipients = this.emailService.getDefaultRecipients();
      if (recipients.length === 0) {
        this.logger.warn('No recipients configured for daily report');
        return false;
      }

      const sent = await this.emailService.sendEmail({
        to: recipients,
        subject: `Fuse Daily Trade Report - ${format(reportDate, 'yyyy-MM-dd')}`,
        html: htmlContent,
      });

      if (sent) {
        this.logger.log(
          `Daily report sent for ${format(reportDate, 'yyyy-MM-dd')}`,
        );
        return true;
      } else {
        this.logger.error(
          `Failed to send daily report for ${format(reportDate, 'yyyy-MM-dd')}`,
        );
        return false;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error generating daily report: ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  private aggregateFailureReasons(failedTrades: Trade[]): FailureReason[] {
    const reasonsMap = new Map<string, number>();

    failedTrades.forEach(trade => {
      const reason = trade.reason || 'Unknown reason';
      const currentCount = reasonsMap.get(reason) || 0;
      reasonsMap.set(reason, currentCount + 1);
    });

    return Array.from(reasonsMap.entries()).map(([reason, count]) => ({
      reason,
      count,
    }));
  }
}
