import {
  Controller,
  Get,
  Param,
  UseInterceptors,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { PortfolioService } from './portfolio.service';
import { PortfolioResponseDto } from './dto/portfolio.dto';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';

// To be implemented in authentication phase
class PortfolioOwnerGuard {
  canActivate() {
    return true; // Placeholder implementation
  }
}

@ApiTags('portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':userId')
  @UseInterceptors(CacheInterceptor)
  @UseGuards(PortfolioOwnerGuard) // This will be implemented when auth is added
  @ApiOperation({ summary: "Get a user's portfolio" })
  @ApiParam({
    name: 'userId',
    description: 'ID of the user whose portfolio to retrieve',
    example: 'user123',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio retrieved successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async getPortfolio(
    @Param('userId') userId: string,
  ): Promise<PortfolioResponseDto> {
    try {
      return this.portfolioService.getUserPortfolio(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error; // Let global exception handler deal with other errors
    }
  }
}
