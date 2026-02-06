/**
 * Configuración de la aplicación Express.
 * Aquí se definen los middlewares, rutas y configuraciones globales.
 */
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { setupSwagger } from './swagger.js';
import testRoutes from './routes/testRoutes.js';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

/**
 * Conexión a la base de datos MongoDB.
 * En entorno de tests evitamos conectar a la base de datos real para mayor velocidad y aislamiento.
 */
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

const app = express();

// --- Middlewares Globales ---

// Habilitar CORS para permitir peticiones desde otros dominios (frontend móvil, etc.)
app.use(cors());

// Middleware para parsear cuerpos de peticiones en formato JSON
app.use(express.json());

// Configuración de Swagger para la documentación de la API
// Se registra antes de las rutas para asegurar que esté accesible
setupSwagger(app);

console.log("APP.JS: Middlewares y Swagger configurados");

// --- Definición de Rutas ---

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health Check - Comprueba si el backend está vivo
 *     responses:
 *       200:
 *         description: El backend funciona correctamente
 */
app.get('/', (req, res) => {
    res.status(200).send('Backend funcionando');
});

// Registrar las rutas de la API bajo el prefijo /api/test
app.use('/api/test', testRoutes);

/**
 * Middleware para el manejo de rutas no encontradas (404).
 * Captura cualquier petición que no coincida con las rutas anteriores.
 */
app.use((req, res) => {
    res.status(404).json({ message: "Ruta no encontrada" });
});

export default app;