import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { catchError, firstValueFrom, retry, throwError, timer } from 'rxjs';
import { AppLogger } from './logger.service';

@Injectable()
export class HttpClient {
  private readonly logger = new AppLogger(HttpClient.name);
  private readonly maxRetries = 3;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('api.key');
    const baseUrl = this.configService.get<string>('api.baseUrl');

    if (!apiKey || !baseUrl) {
      throw new Error('API key and base URL must be configured');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Send a request to the vendor API with retry logic
   * @param method HTTP method
   * @param url Relative URL (without base)
   * @param config Axios request config
   * @returns Promise of the response data
   */
  async request<T = any>(
    method: string,
    url: string,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    const fullUrl = `${this.baseUrl}${url}`;

    // Add API key header
    const headers = {
      ...config.headers,
      'x-api-key': this.apiKey,
    };

    this.logger.debug(`Sending ${method} request to ${fullUrl}`);

    try {
      const response$ = this.httpService.request<T>({
        method,
        url: fullUrl,
        ...config,
        headers,
      }).pipe(
        retry({
          count: this.maxRetries,
          delay: (error, retryCount) => {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
            this.logger.warn(
              `Request to ${fullUrl} failed (attempt ${retryCount}/${this.maxRetries}), retrying in ${delay}ms`,
            );
            return timer(delay);
          },
        }),
        catchError(error => {
          this.logger.error(
            `Request to ${fullUrl} failed after ${this.maxRetries} attempts: ${error.message}`,
            error.stack,
          );

          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            const { status, data } = error.response;
            return throwError(() => ({
              statusCode: status,
              errorCode: 'API_001',
              message: 'Vendor API communication error',
              details: data,
            }));
          } else if (error.request) {
            // The request was made but no response was received
            return throwError(() => ({
              statusCode: 503,
              errorCode: 'API_002',
              message: 'Vendor API service unavailable',
              details: { error: error.message },
            }));
          } else {
            // Something happened in setting up the request
            return throwError(() => new InternalServerErrorException({
              errorCode: 'SYS_001',
              message: 'Error setting up vendor API request',
              details: { error: error.message },
            }));
          }
        }),
      );

      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async get<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>('GET', url, config);
  }

  async post<T = any>(
    url: string,
    data?: any,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    return this.request<T>('POST', url, { ...config, data });
  }

  async put<T = any>(
    url: string,
    data?: any,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    return this.request<T>('PUT', url, { ...config, data });
  }

  async delete<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>('DELETE', url, config);
  }
} 