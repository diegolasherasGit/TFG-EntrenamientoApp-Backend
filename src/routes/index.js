import express from 'express';
import testRoutes from './testRoutes.js';
import userRoutes from './userRoutes.js';
import planRoutes from './planRoutes.js';
import workoutRoutes from './workoutRoutes.js';
import logRoutes from './logRoutes.js';
import trainingStatsRoutes from './trainingStatsRoutes.js';

const router = express.Router();

// Registro de rutas
router.get('/', (req, res) => {
    res.status(200).json({
        message: 'Bulderland API working correctly',
        endpoints: [
            '/test',
            '/users',
            '/training/plans',
            '/training/workouts',
            '/training/logs',
            '/training/stats'
        ]
    });
});

router.use('/test', testRoutes);
router.use('/users', userRoutes);
router.use('/training/plans', planRoutes);
router.use('/training/workouts', workoutRoutes);
router.use('/training/logs', logRoutes);
router.use('/training/stats', trainingStatsRoutes);

export default router;
