import 'reflect-metadata';

import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { requestContextMiddleware } from './common/context/request-context';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { httpMetricsMiddleware } from './infrastructure/metrics/http-metrics.middleware';
import { MetricsService } from './infrastructure/metrics/metrics.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // First middleware: every request gets its own context (read by the data layer for per-user record visibility).
  app.use(requestContextMiddleware);

  app.useLogger(app.get(Logger));
  // `upgrade-insecure-requests` (Helmet's CSP default) makes browsers force
  // Swagger UI's same-origin script/style requests onto HTTPS, which this
  // dev server never serves — the docs page loads (200) but renders blank,
  // since curl doesn't enforce CSP so the bug is invisible outside a real
  // browser. Swagger is dev-only (see below), so scope the relaxed CSP the
  // same way instead of weakening it in production.
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  const globalPrefix = process.env.API_GLOBAL_PREFIX ?? 'api/v1';
  // Probes and the scrape endpoint live outside the versioned prefix.
  app.setGlobalPrefix(globalPrefix, { exclude: ['health', 'health/live', 'health/ready', 'metrics'] });

  // Behind a load balancer / edge proxy the socket peer is the proxy, not the client: without this every user
  // shares one rate-limit bucket and every audit entry shows the proxy's IP. TRUST_PROXY = the number of proxy
  // hops in front of the API (e.g. 1), or `true`/`false`, or a comma-separated list of trusted CIDRs. Unset keeps
  // the previous behaviour (no proxy is trusted).
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const value: boolean | number | string =
      trustProxy === 'true' ? true : trustProxy === 'false' ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', value);
  }

  // Per-request Prometheus metrics (route-pattern labels). Cheap; the /metrics endpoint itself needs METRICS_TOKEN.
  app.use(httpMetricsMiddleware(app.get(MetricsService)));

  const appOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');
  const publicOrigins = process.env.PUBLIC_APPLICATIONS_ORIGINS ?? '*';
  app.enableCors((request: { originalUrl?: string; url?: string }, callback) => {
    // The public website "apply" endpoint is called from the agency's OWN website, which is not (and cannot be) in
    // CORS_ORIGINS. It carries no cookies, so it may be opened to other origins — and ONLY it (PUBLIC_APPLICATIONS_ORIGINS,
    // default any origin). Everything else keeps the strict, credentialed policy below.
    const path = request.originalUrl ?? request.url ?? '';
    if (path.startsWith(`/${globalPrefix}/public/`)) {
      callback(null, {
        origin: publicOrigins === '*' ? true : publicOrigins.split(','),
        credentials: false,
        methods: ['POST', 'OPTIONS'],
        maxAge: 7200,
      });
      return;
    }
    callback(null, {
      origin: appOrigins,
      credentials: true,
      // Lets browsers reuse a preflight result (mutating requests still need one)
      // instead of re-sending OPTIONS before every POST/PATCH/DELETE. 2h is the
      // longest Chromium honors.
      maxAge: 7200,
    });
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor(), new ResponseEnvelopeInterceptor());

  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Recruitment CRM API')
      .setDescription('REST API for the Recruitment CRM + ATS platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  if (process.env.NODE_ENV === 'production' && (process.env.STORAGE_PROVIDER ?? 's3') === 'local') {
    new NestLogger('Bootstrap').warn(
      'STORAGE_PROVIDER=local: uploaded files live on this instance only. Behind a load balancer with more than one replica, use S3-compatible storage.',
    );
  }

  const port = Number(process.env.API_PORT ?? 4000);
  const server = await app.listen(port, process.env.API_HOST ?? '0.0.0.0');

  // Node closes idle keep-alive sockets after 5 s by default. A proxy that reuses a connection at that instant
  // gets a reset (sporadic 502s). Keep sockets open longer than the proxy's own idle timeout (nginx: 65 s), and
  // keep headersTimeout above keepAliveTimeout.
  server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS ?? 65_000);
  server.headersTimeout = server.keepAliveTimeout + 1_000;
}

bootstrap();
