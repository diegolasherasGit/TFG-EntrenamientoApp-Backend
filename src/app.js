import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'mongo-sanitize';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import { setupSwagger } from './config/swagger.js';
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

// Morgan logging middleware
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: () => process.env.NODE_ENV === 'test' // Skip logging in tests
}));

// 1. Cabeceras de Seguridad (Helmet) - M2
app.use(helmet());

// 1b. HTTP Parameter Pollution
app.use(hpp());

// 2. CORS restringido - M1
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:8081'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
}));

// 3. Rate Limiting - M3 (Deshabilitado en tests)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'test' ? 10000 : 100, // Límite mucho mayor en tests
    message: { message: 'Demasiadas peticiones desde esta IP. Por favor, inténtalo de nuevo en 15 minutos.' },
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
// La sanitización de entrada para XSS se manejará de otra manera si es necesario, 
// ya que xss-clean no es compatible con Express 5 (req.query es read-only).

app.use('/uploads', express.static('uploads'));

setupSwagger(app);

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    logger.info("APP.JS: Middlewares y Swagger configurados");
}

// Health Check
app.get('/', (req, res) => {
    res.status(200).send('Backend funcionando');
});

// Rutas de la API
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Ruta no encontrada" });
});

// Global error handler (debe ir al final, después de todas las rutas)
app.use(errorHandler);

export default app;