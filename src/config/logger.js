import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, printf, colorize, align } = winston.format;

// Custom log format
const logFormat = printf((info) => {
    return `[${info.timestamp}] ${info.level}: ${info.message}`;
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        timestamp({
            format: 'YYYY-MM-DD hh:mm:ss.SSS A',
        }),
        align(),
        logFormat
    ),
    transports: [
        // Consola
        new winston.transports.Console({
            format: combine(
                colorize({ all: true }),
                timestamp({
                    format: 'YYYY-MM-DD hh:mm:ss.SSS A',
                }),
                align(),
                logFormat
            ),
            silent: process.env.NODE_ENV === 'test', // Ocultar logs en tests
        }),
        // Archivos (solo errores o info general en producción)
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            silent: process.env.NODE_ENV === 'test',
        }),
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
            silent: process.env.NODE_ENV === 'test',
        }),
    ],
});

export default logger;
