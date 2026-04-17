import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import { setupSwagger } from './config/swagger.js';
import apiRouter from './routes/index.js';
import errorHandler from './middleware/errorMiddleware.js';
import cookieParser from 'cookie-parser';

dotenv.config();

// Conectar a BD (excepto en tests)
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

const app = express();

// 1. Cabeceras de Seguridad (Helmet) - M2
app.use(helmet());

// 2. CORS restringido - M1
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
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

setupSwagger(app);

console.log("APP.JS: Middlewares y Swagger configurados");

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