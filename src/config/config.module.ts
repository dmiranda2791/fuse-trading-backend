import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),

        // API Configuration
        FUSE_API_KEY: Joi.string().required(),
        FUSE_API_BASE_URL: Joi.string().required(),

        // Database Configuration
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),

        // Redis Configuration
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().default(6379),

        // Email Configuration
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().allow(''),
        SMTP_PASS: Joi.string().allow(''),
        EMAIL_FROM: Joi.string().email().required(),
        EMAIL_RECIPIENTS: Joi.string().required(),

        // Optional Configurations
        ENABLE_MAILGUN: Joi.boolean().default(false),
        MAILGUN_API_KEY: Joi.string().allow(''),
        MAILGUN_DOMAIN: Joi.string().allow(''),

        ENABLE_SENTRY: Joi.boolean().default(false),
        ENABLE_DATADOG: Joi.boolean().default(false),

        QUEUE_CONCURRENCY: Joi.number().default(10),
      }),
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule { } 