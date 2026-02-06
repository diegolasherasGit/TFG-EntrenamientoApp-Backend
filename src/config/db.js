/**
 * Configuración de la conexión a la base de datos MongoDB utilizando Mongoose.
 */
import mongoose from 'mongoose';

/**
 * Función que intenta conectar a la base de datos con reintentos automáticos.
 * Útil cuando el contenedor de MongoDB tarda un poco más en arrancar que el backend.
 */
const connectWithRetry = async () => {
  const maxRetries = 10;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Intento de conexión usando la URI de las variables de entorno
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB conectado: ${conn.connection.host}`);
      return;
    } catch (err) {
      retries++;
      console.log(`Intento ${retries} de conexión fallido: ${err.message}. Reintentando en 3s...`);
      // Esperar 3 segundos antes del próximo intento
      await new Promise(res => setTimeout(res, 3000));
    }
  }

  // Si después de los reintentos no se puede conectar, frenamos el proceso
  console.error("No se pudo conectar a MongoDB después de varios intentos.");
  process.exit(1);
};

export const connectDB = connectWithRetry;
