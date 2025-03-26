import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class StockSymbolValidationPipe
  implements PipeTransform<string, string>
{
  transform(value: string, _metadata: ArgumentMetadata): string {
    // Symbol validation
    if (typeof value !== 'string') {
      throw new BadRequestException({
        errorCode: 'VAL_003',
        message: 'Invalid stock symbol: must be a string',
      });
    }

    const isValid = /^[A-Z0-9]{1,10}$/.test(value);

    if (!isValid) {
      throw new BadRequestException({
        errorCode: 'VAL_003',
        message: 'Invalid stock symbol format',
        details: {
          symbol: value,
          constraints: {
            pattern: '^[A-Z0-9]{1,10}$',
            message: 'Symbol must be 1-10 uppercase letters or numbers',
          },
        },
      });
    }

    return value;
  }
}
