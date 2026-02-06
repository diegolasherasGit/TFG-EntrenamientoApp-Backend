import mongoose from 'mongoose';

// Conexión con reintentos para Docker
const connectWithRetry = async () => {
  const maxRetries = 10;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB conectado: ${conn.connection.host}`);
      return;
    } catch (err) {
      retries++;
      console.log(`Intento ${retries} fallido: ${err.message}. Reintentando...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }

  // Error fatal si no conecta
  console.error("No se pudo conectar a MongoDB.");
  process.exit(1);
};

export const connectDB = connectWithRetry;
