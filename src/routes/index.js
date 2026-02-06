/**
 * Centralizador de rutas del API.
 * Aquí se importan y registran todos los módulos de rutas.
 */
import express from 'express';
import testRoutes from './testRoutes.js';

const router = express.Router();

// Registro de módulos de rutas
// Cada módulo debe tener su propio prefijo lógico
router.use('/test', testRoutes);

// Aquí se añadirán más rutas en el futuro (ej: router.use('/users', userRoutes))

export default router;
