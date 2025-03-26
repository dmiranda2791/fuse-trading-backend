import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { VendorStockListResponseDto } from './dto/stock-list.dto';

@Injectable()
export class StocksHttpService {
  private readonly logger = new Logger(StocksHttpService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries = 3;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>('api.baseUrl');
    const apiKey = this.configService.get<string>('api.key');

    if (!baseUrl || !apiKey) {
      throw new Error('Missing required configuration: api.baseUrl or api.key');
    }

    this.baseUrl = baseUrl;
    this.apiKey = apiKey;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds
    });
  }

  async getStocks(nextToken?: string): Promise<VendorStockListResponseDto> {
    const url = `/stocks${nextToken ? `?nextToken=${nextToken}` : ''}`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Fetching stocks from vendor API: ${url}, attempt: ${attempt}`);
        const response = await this.httpClient.get(url);

        if (response.data?.status === 200 && response.data?.data) {
          return response.data.data;
        }

        throw new Error('Unexpected response format from vendor API');
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries;

        if (error.response) {
          // The request was made and the server responded with a status code outside of 2xx range
          this.logger.error(
            `Vendor API error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`,
            error.stack,
          );

          if (isLastAttempt) {
            throw new HttpException(
              `Failed to fetch stocks after ${this.maxRetries} attempts`,
              HttpStatus.BAD_GATEWAY
            );
          }
        } else if (error.request) {
          // The request was made but no response was received
          this.logger.error(`Vendor API request error: No response received`, error.stack);

          if (isLastAttempt) {
            throw new HttpException(
              `Vendor API unavailable after ${this.maxRetries} attempts`,
              HttpStatus.SERVICE_UNAVAILABLE
            );
          }
        } else {
          // Error in setting up the request
          this.logger.error(`Vendor API setup error: ${error.message}`, error.stack);

          if (isLastAttempt) {
            throw new HttpException(
              'Error connecting to vendor API',
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
        }

        // Exponential backoff with jitter
        if (!isLastAttempt) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          const jitter = Math.random() * 1000;
          const delay = backoff + jitter;

          this.logger.debug(`Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // This should never be reached due to the retry logic above,
    // but TypeScript requires an explicit return to satisfy the return type
    throw new HttpException(
      'Failed to fetch stocks due to an unexpected error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
} 