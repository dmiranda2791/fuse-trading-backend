import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppLogger } from './common/utils/logger.service';

async function bootstrap() {
  // Create app with custom logger
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use our custom logger for application logs
  const logger = new AppLogger('Bootstrap');
  app.useLogger(logger);

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Fuse Trading API')
    .setDescription('API for stock trading operations')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .addTag('stocks', 'Stock related operations')
    .addTag('portfolio', 'Portfolio management')
    .addTag('trades', 'Trade execution')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}

bootstrap().catch(err => {
  const logger = new AppLogger('Bootstrap');
  const errorStack = err instanceof Error ? err.stack : undefined;
  logger.error('Failed to start application', errorStack);
  process.exit(1);
});
