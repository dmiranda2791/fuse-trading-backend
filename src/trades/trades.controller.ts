import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TradesService } from './trades.service';
import { BuyStockDto } from './dto/buy-stock.dto';
import { TradeResponseDto } from './dto/trade-response.dto';
import { StockSymbolValidationPipe } from './pipes/stock-symbol-validation.pipe';

@ApiTags('trades')
@Controller()
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Post('stocks/:symbol/buy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buy a stock' })
  @ApiParam({
    name: 'symbol',
    description: 'Stock symbol (1-10 uppercase letters or numbers)',
    example: 'AAPL',
  })
  @ApiBody({ type: BuyStockDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The trade has been successfully executed',
    type: TradeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input parameters or price out of range',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Stock symbol not found',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Vendor API unavailable',
  })
  async buyStock(
    @Param('symbol', StockSymbolValidationPipe) symbol: string,
    @Body() buyStockDto: BuyStockDto,
    @Headers('x-user-id') userId: string,
  ): Promise<TradeResponseDto> {
    return this.tradesService.buyStock(userId, symbol, buyStockDto);
  }
}
