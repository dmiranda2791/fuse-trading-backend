import {
  Controller,
  Get,
  Param,
  NotFoundException,
  UseGuards,
  Query,
  Logger,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioItemDto } from './dto/portfolio.dto';
import { CursorPaginatedResponseDto } from '../common/dto/pagination.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

// To be implemented in authentication phase
class PortfolioOwnerGuard {
  canActivate() {
    return true; // Placeholder implementation
  }
}

@ApiTags('portfolio')
@Controller('portfolio')
export class PortfolioController {
  private readonly logger = new Logger(PortfolioController.name);

  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':userId')
  @UseGuards(PortfolioOwnerGuard) // This will be implemented when auth is added
  @ApiOperation({ summary: "Get a user's portfolio" })
  @ApiParam({
    name: 'userId',
    description: 'ID of the user whose portfolio to retrieve',
    example: 'user123',
  })
  @ApiQuery({
    name: 'nextToken',
    required: false,
    type: String,
    description: 'Token for the next page of results',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio retrieved successfully',
    type: CursorPaginatedResponseDto<PortfolioItemDto>,
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async getPortfolio(
    @Param('userId') userId: string,
    @Query('nextToken') nextToken?: string,
  ): Promise<CursorPaginatedResponseDto<PortfolioItemDto>> {
    try {
      this.logger.debug(
        `Getting portfolio for user ${userId} with nextToken: ${nextToken || 'none'}`,
      );
      return this.portfolioService.getUserPortfolio(userId, nextToken);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error; // Let global exception handler deal with other errors
    }
  }
}
