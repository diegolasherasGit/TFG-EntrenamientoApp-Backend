import express from 'express';
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'mongo-sanitize';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { connectDB } from './config/db.js';
import { setupSwagger } from './config/swagger.js';
import { getCorsOrigins } from './config/cors.js';
import apiRouter from './routes/index.js';
import errorHandler from './middleware/errorMiddleware.js';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import logger from './config/logger.js';

dotenv.config();

// Conectar a BD (excepto en tests)
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

const app = express();

// Detrás del proxy inverso (Nginx/Traefik) confiamos en el primer salto, para que
// req.ip sea la IP real del cliente (X-Forwarded-For) y no la del proxy. Sin esto,
// el rate limiter metería a TODOS los usuarios en el mismo cubo de IP.
app.set('trust proxy', 1);

// Registro de peticiones HTTP con Morgan: cada línea se canaliza a nuestro logger
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: () => process.env.NODE_ENV === 'test' // No registrar peticiones durante los tests
}));

// 1. Cabeceras de Seguridad (Helmet) - M2
app.use(helmet());

// 1b. HTTP Parameter Pollution
app.use(hpp());

// 2. CORS restringido - M1 (política compartida con Socket.io, ver config/cors.js)
app.use(cors({
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
}));

// 3. Rate Limiting - M3 (Deshabilitado en tests)
// El limiter corre ANTES de `protect`, así que para clavar el cubo por usuario
// (y no por IP compartida: proxy inverso, WiFi del rocódromo, NAT) leemos aquí el
// JWT del header. Si no hay token válido (login, registro...), se limita por IP.
export const userOrIpKey = (req) => {
    const auth = req.headers.authorization;
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token && process.env.JWT_SECRET) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded?.id) {
                return `u:${decoded.id}`;
            }
        } catch {
            // token inválido o caducado -> caemos a la IP
        }
    }
    return ipKeyGenerator(req.ip);
};

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    // Límite por usuario/IP en producción; en desarrollo/test/E2E se eleva para no
    // bloquear el sondeo de la app ni las suites de pruebas (que hacen muchas peticiones).
    max: process.env.NODE_ENV === 'production' ? 300 : 10000,
    keyGenerator: userOrIpKey,
    message: { message: 'Demasiadas peticiones. Por favor, inténtalo de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// 4. Body parser con límite razonable
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// 5. Sanitización de entrada (NoSQL injection + XSS)
const sanitizeInput = (value) => {
    if (value === null || value === undefined) {return value;}
    if (typeof value === 'object') {
        if (Array.isArray(value)) {return value.map(sanitizeInput);}
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, sanitizeInput(v)])
        );
    }
    return mongoSanitize(value);
};

app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {req.body = sanitizeInput(req.body);}
    next();
});

setupSwagger(app);

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    logger.info("APP.JS: Middlewares y Swagger configurados");
}

// Comprobación de salud: confirma que el servidor está vivo y responde
app.get('/', (req, res) => {
    res.status(200).send('Backend funcionando');
});

// Rutas de la API
app.use('/api', apiRouter);

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
    res.status(404).json({ message: "Ruta no encontrada" });
});

// Captura de errores en Sentry (solo si está configurado). Va antes del
// handler global: Sentry registra el error 5xx y delega la respuesta a errorHandler.
if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

// Manejador de errores global (debe ir el último, después de todas las rutas)
app.use(errorHandler);

export default app;