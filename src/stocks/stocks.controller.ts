import {
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
  Param,
  ParseIntPipe,
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
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (starts at 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 25)',
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
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ): Promise<StockListResponseDto> {
    this.logger.debug(`Getting stocks page: ${page}, limit: ${limit}`);
    return this.stocksService.getStocks(page, limit);
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
