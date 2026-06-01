import express from 'express';
import userRoutes from './userRoutes.js';
import planRoutes from './planRoutes.js';
import workoutRoutes from './workoutRoutes.js';
import logRoutes from './logRoutes.js';
import trainingStatsRoutes from './trainingStatsRoutes.js';
import techniqueVideoRoutes from './techniqueVideoRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const router = express.Router();

// Registro de rutas
router.get('/', (req, res) => {
    res.status(200).json({
        message: 'Bulderland API working correctly',
        endpoints: [
            '/users',
            '/training/plans',
            '/training/workouts',
            '/training/logs',
            '/training/stats',
            '/training/stats/dashboard',
            '/technique-videos',
            '/notifications'
        ]
    });
});

router.use('/users', userRoutes);
router.use('/training/plans', planRoutes);
router.use('/training/workouts', workoutRoutes);
router.use('/training/logs', logRoutes);
router.use('/training/stats', trainingStatsRoutes);
router.use('/technique-videos', techniqueVideoRoutes);
router.use('/notifications', notificationRoutes);

export default router;
