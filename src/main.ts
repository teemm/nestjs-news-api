import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const appUrl = config.get('APP_URL', { infer: true });

  app.setGlobalPrefix('api');

  app.use(
    helmet({
      // Uploaded images must stay loadable from other origins (e.g. a SPA on :5173).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();
  app.get(PrismaService).enableShutdownHooks(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('News API')
    .setDescription(
      'NestJS 11 + Prisma (MongoDB) REST API with JWT authentication and image uploads.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'bearer')
    .addServer(appUrl)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API      -> ${appUrl}/api`);
  logger.log(`Swagger  -> ${appUrl}/api/docs`);
  logger.log(`Uploads  -> ${appUrl}/uploads/news`);
}

void bootstrap();
