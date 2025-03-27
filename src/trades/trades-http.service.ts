import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { BuyStockDto } from './dto/buy-stock.dto';

interface VendorApiResponse {
  status: number;
  data?: any;
  message?: string;
}

interface BuyResponse {
  status: number;
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

@Injectable()
export class TradesHttpService {
  private readonly logger = new Logger(TradesHttpService.name);
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

  /**
   * Execute a buy order with the vendor API
   * @param symbol Stock symbol to buy
   * @param buyStockDto Price and quantity information
   * @returns Response from vendor API
   */
  async buyStock(
    symbol: string,
    buyStockDto: BuyStockDto,
  ): Promise<BuyResponse> {
    const url = `/stocks/${symbol}/buy`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Executing buy order for ${symbol}, attempt: ${attempt}`,
        );

        this.logger.debug('Sending HTTP request to vendor API');
        const response = await this.httpClient.post<VendorApiResponse>(
          url,
          buyStockDto,
        );

        this.logger.debug('Received response from vendor API');

        if (response.status === 200 && response.data) {
          this.logger.debug('Vendor API request successful');
          return {
            status: response.status,
            success: true,
            message: 'Trade executed successfully',
            data: response.data,
          };
        }

        this.logger.debug('Unexpected response format from vendor API');
        throw new Error('Unexpected response format from vendor API');
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries;
        const axiosError = error as AxiosError;

        if (axiosError.response) {
          // The request was made and the server responded with a status code outside of 2xx range
          const responseData = axiosError.response.data as
            | VendorApiResponse
            | undefined;
          const statusCode = axiosError.response.status;
          const errorMessage = responseData?.message || 'Unknown error';

          this.logger.error(
            `Vendor API error: ${statusCode} - ${errorMessage}`,
            axiosError instanceof Error ? axiosError.stack : undefined,
          );

          // Handle specific error cases from the vendor API
          if (statusCode === 400) {
            // Price validation error from vendor
            if (errorMessage.includes('price')) {
              return {
                status: statusCode,
                success: false,
                message: 'Price out of acceptable range',
              };
            }
          }

          if (isLastAttempt) {
            if (statusCode === 404) {
              return {
                status: statusCode,
                success: false,
                message: `Stock with symbol ${symbol} not found`,
              };
            }

            return {
              status: statusCode,
              success: false,
              message: errorMessage || 'Failed to execute trade',
            };
          }
        } else if (axiosError.request) {
          // The request was made but no response was received
          this.logger.error(
            `Vendor API request error: No response received`,
            axiosError instanceof Error ? axiosError.stack : undefined,
          );

          if (isLastAttempt) {
            return {
              status: HttpStatus.SERVICE_UNAVAILABLE,
              success: false,
              message: 'Vendor API unavailable, please try again later',
            };
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
            return {
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              success: false,
              message: 'Error connecting to vendor API',
            };
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
    // but TypeScript requires an explicit return
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to execute trade due to an unexpected error',
    };
  }
}
