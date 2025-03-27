import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { APP_FILTER, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import {
  HttpExceptionFilter,
  AllExceptionsFilter,
} from './filters/http-exception.filter';
import { HttpCacheInterceptor } from './interceptors/cache.interceptor';
import { ValidationPipe } from './pipes/validation.pipe';
import { AppLogger } from './utils/logger.service';
import { HttpClient } from './utils/http.util';
import { HealthModule } from './health/health.module';

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000, // 5 seconds default timeout
      maxRedirects: 3,
    }),
    HealthModule,
  ],
  providers: [
    {
      provide: AppLogger,
      useFactory: () => new AppLogger(),
    },
    HttpClient,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
  exports: [AppLogger, HttpClient, HealthModule],
})
export class CommonModule {}
