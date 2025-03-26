import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsNumber, IsInt, IsPositive, Max } from 'class-validator';

export class BuyStockDto {
  @ApiProperty({
    example: 220.67,
    description: 'The price to buy the stock at',
  })
  @IsNumber()
  @IsPositive()
  @Max(1000000)
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      return parseFloat(parseFloat(value).toFixed(2));
    }
    if (typeof value === 'number') {
      return parseFloat(value.toFixed(2));
    }
    return 0; // Default fallback, validation will catch this as invalid
  })
  price: number;

  @ApiProperty({
    example: 5,
    description: 'The quantity to buy',
  })
  @IsInt()
  @IsPositive()
  @Max(10000)
  quantity: number;
}
