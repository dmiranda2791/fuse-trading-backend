import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard response format for cursor-based pagination
 */
export class CursorPaginatedResponseDto<T> {
  @ApiProperty({
    description: 'List of items',
    isArray: true,
  })
  items: T[];

  @ApiProperty({
    description:
      'Token for the next page of results. Null when there are no more pages.',
    required: true,
    example: 'eyJvZmZzZXQiOjEwfQ==',
    nullable: true,
  })
  nextToken: string | null;
}
