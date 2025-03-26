import { ApiProperty } from '@nestjs/swagger';

// Represents a single holding in a user's portfolio
export class PortfolioItemDto {
  @ApiProperty({ description: 'Stock symbol', example: 'AAPL' })
  symbol: string;

  @ApiProperty({ description: 'Quantity of shares owned', example: 10 })
  quantity: number;
}

// Complete portfolio response with holdings
export class PortfolioResponseDto {
  @ApiProperty({
    description: 'User ID of the portfolio owner',
    example: 'user123',
  })
  userId: string;

  @ApiProperty({
    description: 'Array of stock holdings',
    type: [PortfolioItemDto],
  })
  holdings: PortfolioItemDto[];

  @ApiProperty({
    description: 'Total number of different stocks in portfolio',
    example: 5,
  })
  totalStocks: number;

  @ApiProperty({
    description: 'Total number of shares across all holdings',
    example: 42,
  })
  totalShares: number;
}
