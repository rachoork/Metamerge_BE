import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exceptions/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter for consistent error handling
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable CORS
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:3001',
    'http://localhost:3000',
    ...(frontendOrigin ? [frontendOrigin] : []),
  ];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins for development
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // Re-enable strict validation
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`MetaMerge Backend running on http://localhost:${port}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`);
    try {
      const deepResearchWorker = app.get('DeepResearchWorkerService');
      if (deepResearchWorker && typeof deepResearchWorker.stopProcessing === 'function') {
        deepResearchWorker.stopProcessing();
      }
    } catch (error) {
      // Service might not be available, continue shutdown
    }
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();

