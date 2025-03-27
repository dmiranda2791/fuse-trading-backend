import { ApiProperty } from '@nestjs/swagger';
import { StockDto } from './stock.dto';
import { CursorPaginatedResponseDto } from '../../common/dto/pagination.dto';

export class PaginationQueryDto {
  @ApiProperty({
    example: 'abc123',
    description: 'Token for the next page of results',
    required: false,
  })
  nextToken?: string;
}

export class StockListResponseDto extends CursorPaginatedResponseDto<StockDto> {}

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
