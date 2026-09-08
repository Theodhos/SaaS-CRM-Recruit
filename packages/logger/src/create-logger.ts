import pino, { type Logger, type LoggerOptions } from 'pino';

export interface CreateLoggerOptions {
  serviceName: string;
  level?: string;
  format?: 'json' | 'pretty';
}

/**
 * Every app (api/worker/realtime) creates its logger through this factory so
 * log shape (service name, level, transport) stays consistent. Structured
 * fields (requestId, organisationId, userId) are attached per-call-site via
 * `logger.child({...})`, never baked in here.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const { serviceName, level = 'info', format = 'json' } = options;

  const pinoOptions: LoggerOptions = {
    level,
    base: { service: serviceName },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'password',
        'passwordHash',
        '*.password',
        '*.passwordHash',
      ],
      censor: '[REDACTED]',
    },
  };

  if (format === 'pretty') {
    return pino({
      ...pinoOptions,
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
  }

  return pino(pinoOptions);
}
