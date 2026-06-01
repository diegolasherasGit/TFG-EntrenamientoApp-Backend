import mongoose from 'mongoose';
import softDeletePlugin from '../models/plugins/softDelete.js';
import logger from './logger.js';

// Registrar plugin globalmente
mongoose.plugin(softDeletePlugin);

// Conexión con reintentos para Docker
const connectWithRetry = async () => {
  const maxRetries = 10;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);
      logger.info(`MongoDB conectado: ${conn.connection.host}`);
      return;
    } catch (err) {
      retries++;
      logger.warn(`Intento ${retries} fallido: ${err.message}. Reintentando...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }

  // Error fatal si no conecta
  logger.error("No se pudo conectar a MongoDB.");
  process.exit(1);
};

export const connectDB = connectWithRetry;
