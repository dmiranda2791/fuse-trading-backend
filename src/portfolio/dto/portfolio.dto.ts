import { ApiProperty } from '@nestjs/swagger';

// Represents a single holding in a user's portfolio
export class PortfolioItemDto {
  @ApiProperty({
    description: 'User ID of the portfolio owner',
    example: 'user123',
  })
  userId: string;

  @ApiProperty({ description: 'Stock symbol', example: 'AAPL' })
  symbol: string;

  @ApiProperty({ description: 'Quantity of shares owned', example: 10 })
  quantity: number;
}
