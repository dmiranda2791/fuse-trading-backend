import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { TradesHttpService } from './trades-http.service';
import { Trade } from './trade.entity';
import { StocksModule } from '../stocks/stocks.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [TypeOrmModule.forFeature([Trade]), StocksModule, PortfolioModule],
  controllers: [TradesController],
  providers: [TradesService, TradesHttpService],
  exports: [TradesService],
})
export class TradesModule {}
