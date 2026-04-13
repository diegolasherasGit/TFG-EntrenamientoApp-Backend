import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import { setupSwagger } from './config/swagger.js';
import errorHandler from './middleware/errorMiddleware.js';
import apiRouter from './routes/index.js';

dotenv.config();

// Conectar a BD (excepto en tests)
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

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

// Global Error Handler
app.use(errorHandler);

export default app;