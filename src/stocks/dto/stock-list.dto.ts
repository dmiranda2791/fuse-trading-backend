import { ApiProperty } from '@nestjs/swagger';
import { StockDto } from './stock.dto';

export class PaginationQueryDto {
  @ApiProperty({
    example: 1,
    description: 'Page number (starts at 1)',
    required: false,
    default: 1,
  })
  page?: number;

  @ApiProperty({
    example: 25,
    description: 'Items per page',
    required: false,
    default: 25,
  })
  limit?: number;
}

export class StockListResponseDto {
  @ApiProperty({ description: 'List of stocks', type: [StockDto] })
  items: StockDto[];

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 25, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 100, description: 'Total number of items' })
  totalItems: number;

  @ApiProperty({ example: 4, description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ example: true, description: 'Whether there is a next page' })
  hasNextPage: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether there is a previous page',
  })
  hasPreviousPage: boolean;
}

// DTO for vendor API response
export class VendorStockDto {
  symbol: string;
  name: string;
  price: number;
}

export class VendorStockListResponseDto {
  items: VendorStockDto[];
  nextToken?: string;
}
