import pino, { type LoggerOptions } from 'pino';

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
};

export const logger = pino(options);

export type Logger = typeof logger;
