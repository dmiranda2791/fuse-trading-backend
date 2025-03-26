import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseStockSymbolPipe implements PipeTransform {
  private readonly SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;

  transform(value: any, metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException({
        errorCode: 'VAL_003',
        message: 'Stock symbol must be a string',
      });
    }

    // Convert to uppercase for consistency
    const symbol = value.toUpperCase();

    if (!this.SYMBOL_REGEX.test(symbol)) {
      throw new BadRequestException({
        errorCode: 'VAL_003',
        message: 'Invalid stock symbol format. Must contain only uppercase letters and numbers, max 10 characters.',
      });
    }

    return symbol;
  }
} 