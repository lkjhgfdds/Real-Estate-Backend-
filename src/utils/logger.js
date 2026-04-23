const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const logDir = path.join(process.cwd(), 'logs');

const formats = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack }) =>
    `${timestamp} [${level}]: ${stack || message}`
  )
);

const transports = [
  new winston.transports.DailyRotateFile({
    filename:     path.join(logDir, 'error-%DATE%.log'),
    datePattern:  'YYYY-MM-DD',
    level:        'error',
    maxFiles:     '30d',
    maxSize:      '20m',
    zippedArchive: true,
  }),
  new winston.transports.DailyRotateFile({
    filename:     path.join(logDir, 'combined-%DATE%.log'),
    datePattern:  'YYYY-MM-DD',
    maxFiles:     '14d',
    maxSize:      '20m',
    zippedArchive: true,
  }),
];

if (process.env.NODE_ENV !== 'production') {
  transports.push(new winston.transports.Console({ format: consoleFormat }));
}

const logger = winston.createLogger({
  level:      process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
  format:     formats,
  transports,
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
});

module.exports = logger;
