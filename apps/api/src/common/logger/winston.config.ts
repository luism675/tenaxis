import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

interface LogInfo {
  level: string;
  message: string;
  timestamp?: string;
  context?: string;
  ms?: string;
}

export const winstonConfig = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        winston.format.colorize(),
        winston.format.printf((info) => {
          const { timestamp, level, message, context, ms } =
            info as unknown as LogInfo;
          const ctx = context || 'Application';
          return `[Nest] ${String(timestamp)} ${level} [${ctx}] ${message} ${String(ms)}`;
        }),
      ),
    }),
  ],
});
