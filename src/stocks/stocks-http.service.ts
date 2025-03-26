import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { VendorStockListResponseDto } from './dto/stock-list.dto';

interface VendorApiResponse {
  status: number;
  data?: VendorStockListResponseDto;
  message?: string;
}

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
        this.logger.debug(
          `Fetching stocks from vendor API: ${url}, attempt: ${attempt}`,
        );
        const response = await this.httpClient.get<VendorApiResponse>(url);

        if (response.status === 200 && response.data?.data) {
          return response.data.data;
        }

        throw new Error('Unexpected response format from vendor API');
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries;
        const axiosError = error as AxiosError;

        if (axiosError.response) {
          // The request was made and the server responded with a status code outside of 2xx range
          const responseData = axiosError.response.data as
            | VendorApiResponse
            | undefined;
          const errorMessage = responseData?.message || 'Unknown error';

          this.logger.error(
            `Vendor API error: ${axiosError.response.status} - ${errorMessage}`,
            axiosError instanceof Error ? axiosError.stack : undefined,
          );

          if (isLastAttempt) {
            throw new HttpException(
              `Failed to fetch stocks after ${this.maxRetries} attempts`,
              HttpStatus.BAD_GATEWAY,
            );
          }
        } else if (axiosError.request) {
          // The request was made but no response was received
          this.logger.error(
            `Vendor API request error: No response received`,
            axiosError instanceof Error ? axiosError.stack : undefined,
          );

          if (isLastAttempt) {
            throw new HttpException(
              `Vendor API unavailable after ${this.maxRetries} attempts`,
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }
        } else {
          // Error in setting up the request
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;

          this.logger.error(
            `Vendor API setup error: ${errorMessage}`,
            errorStack,
          );

          if (isLastAttempt) {
            throw new HttpException(
              'Error connecting to vendor API',
              HttpStatus.INTERNAL_SERVER_ERROR,
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
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
