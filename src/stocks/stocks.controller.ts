import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { StocksService } from './stocks.service';
import { StockDto } from './dto/stock.dto';
import { StockListResponseDto } from './dto/stock-list.dto';
import { ParseStockSymbolPipe } from './pipes/parse-stock-symbol.pipe';

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  private readonly logger = new Logger(StocksController.name);

  constructor(private readonly stocksService: StocksService) {}

  @ApiOperation({ summary: 'Get all stocks' })
  @ApiQuery({
    name: 'nextToken',
    required: false,
    type: String,
    description: 'Token for the next page of results',
  })
  @ApiResponse({
    status: 200,
    description: 'List of stocks',
    type: StockListResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseInterceptors(CacheInterceptor)
  @Get()
  async getStocks(
    @Query('nextToken') nextToken?: string,
  ): Promise<StockListResponseDto> {
    this.logger.debug(`Getting stocks with nextToken: ${nextToken || 'none'}`);
    return this.stocksService.getStocks(nextToken);
  }

  @ApiOperation({ summary: 'Get a stock by symbol' })
  @ApiParam({
    name: 'symbol',
    type: String,
    description: 'Stock symbol',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock found',
    type: StockDto,
  })
  @ApiResponse({ status: 404, description: 'Stock not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseInterceptors(CacheInterceptor)
  @Get(':symbol')
  async getStockBySymbol(
    @Param('symbol', ParseStockSymbolPipe) symbol: string,
  ): Promise<StockDto> {
    this.logger.debug(`Getting stock by symbol: ${symbol}`);
    return this.stocksService.getStockBySymbol(symbol);
  }
}
