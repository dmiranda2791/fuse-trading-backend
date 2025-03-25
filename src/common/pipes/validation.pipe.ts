import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { AppLogger } from '../utils/logger.service';

@Injectable()
export class ValidationPipe implements PipeTransform {
  private readonly logger = new AppLogger(ValidationPipe.name);

  async transform(value: any, metadata: ArgumentMetadata) {
    // Skip validation if no value or no metadata type
    if (value === undefined || !metadata.metatype) {
      return value;
    }

    // Skip validation for native JavaScript types
    const primitiveTypes = [String, Boolean, Number, Array, Object];
    const isNative = primitiveTypes.some(type => metadata.metatype === type);
    if (isNative) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToInstance(metadata.metatype, value);

    // Validate the transformed object
    const errors = await validate(object);

    if (errors.length > 0) {
      const formattedErrors = this.formatErrors(errors);
      this.logger.debug(`Validation failed: ${JSON.stringify(formattedErrors)}`);
      throw new BadRequestException({
        errorCode: 'VAL_001',
        message: 'Validation failed',
        details: formattedErrors,
      });
    }

    return object;
  }

  private formatErrors(errors: ValidationError[]): Record<string, string[]> {
    return errors.reduce<Record<string, string[]>>((acc, error) => {
      if (error.constraints) {
        const property = error.property;
        const constraints = Object.values(error.constraints);
        acc[property] = constraints;
      }

      // Recursively format nested errors
      if (error.children && error.children.length > 0) {
        const nestedErrors = this.formatErrors(error.children);
        Object.keys(nestedErrors).forEach(key => {
          const nestedKey = `${error.property}.${key}`;
          acc[nestedKey] = nestedErrors[key];
        });
      }

      return acc;
    }, {});
  }
}

// Stock symbol validation pipe
export class StockSymbolPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (typeof value !== 'string' || !value) {
      throw new BadRequestException({
        errorCode: 'VAL_003',
        message: 'Invalid stock symbol',
        details: { symbol: 'Stock symbol is required and must be a string' },
      });
    }

    // Check symbol format - uppercase alphanumeric with max length 10
    const isValid = /^[A-Z0-9]{1,10}$/.test(value);
    if (!isValid) {
      throw new BadRequestException({
        errorCode: 'VAL_003',
        message: 'Invalid stock symbol format',
        details: { symbol: 'Symbol must contain only uppercase letters and numbers with max length 10' },
      });
    }

    return value;
  }
} 