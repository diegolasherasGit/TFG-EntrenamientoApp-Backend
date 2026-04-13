import express from 'express';
import testRoutes from './testRoutes.js';
import userRoutes from './userRoutes.js';
import planRoutes from './planRoutes.js';
import workoutRoutes from './workoutRoutes.js';
import logRoutes from './logRoutes.js';
import trainingStatsRoutes from './trainingStatsRoutes.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Registro de rutas genéricas
router.use('/test', testRoutes);
router.use('/users', userRoutes);

// Aplicar seguridad JWT a todo el módulo de entrenamiento
router.use('/training/plans', protect, planRoutes);
router.use('/training/workouts', protect, workoutRoutes);
router.use('/training/logs', protect, logRoutes);
router.use('/training/stats', protect, trainingStatsRoutes);

export default router;
