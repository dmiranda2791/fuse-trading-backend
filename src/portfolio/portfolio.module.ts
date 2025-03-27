import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portfolio } from './portfolio.entity';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { StocksModule } from '../stocks/stocks.module';

@Module({
  imports: [TypeOrmModule.forFeature([Portfolio]), StocksModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService], // Export service to be used by other modules (like TradeModule)
})
export class PortfolioModule {}
