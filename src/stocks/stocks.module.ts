import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './stock.entity';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { StocksHttpService } from './stocks-http.service';
import { PaginationService } from './pagination.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stock]),
  ],
  controllers: [StocksController],
  providers: [StocksService, StocksHttpService, PaginationService],
  exports: [StocksService], // Export for use in other modules (e.g., Trades)
})
export class StocksModule { } 