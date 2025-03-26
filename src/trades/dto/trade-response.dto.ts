import { ApiProperty } from '@nestjs/swagger';
import { TradeStatus } from '../trade.entity';

export class TradeResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Trade ID',
  })
  id: string;

  @ApiProperty({
    example: 'user-123',
    description: 'User ID',
  })
  userId: string;

  @ApiProperty({
    example: 'AAPL',
    description: 'Stock symbol',
  })
  symbol: string;

  @ApiProperty({
    example: 220.67,
    description: 'Trade price',
  })
  price: number;

  @ApiProperty({
    example: 5,
    description: 'Quantity bought',
  })
  quantity: number;

  @ApiProperty({
    enum: TradeStatus,
    example: TradeStatus.SUCCESS,
    description: 'Trade status',
  })
  status: TradeStatus;

  @ApiProperty({
    example: '2023-03-25T12:00:00Z',
    description: 'Trade timestamp',
  })
  timestamp: Date;

  @ApiProperty({
    example: 'Price out of acceptable range',
    description: 'Reason for failed trades',
    required: false,
  })
  reason?: string;
}
