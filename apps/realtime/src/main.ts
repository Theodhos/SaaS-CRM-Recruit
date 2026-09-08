import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const port = Number(process.env.REALTIME_PORT ?? 4001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Realtime gateway listening on port ${port}`);
}

bootstrap();
