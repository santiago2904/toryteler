import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Anything not declared in a DTO is stripped, and an unexpected field is an
  // error rather than something silently ignored.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  app.enableCors({ origin: process.env.PUBLIC_WEB_URL, credentials: true });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
