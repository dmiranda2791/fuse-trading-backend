import { ApiProperty } from '@nestjs/swagger';

export class StockDto {
  @ApiProperty({ example: 'AAPL', description: 'Stock symbol' })
  symbol: string;

  @ApiProperty({ example: 'Apple Inc.', description: 'Company name' })
  name: string;

  @ApiProperty({ example: 154.67, description: 'Current stock price' })
  price: number;
}
