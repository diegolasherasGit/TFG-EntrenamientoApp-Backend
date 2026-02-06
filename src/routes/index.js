import express from 'express';
import testRoutes from './testRoutes.js';
import userRoutes from './userRoutes.js';

const router = express.Router();

// Registro de rutas
router.use('/test', testRoutes);
router.use('/users', userRoutes);

export default router;
