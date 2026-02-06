import express from 'express';
import testRoutes from './testRoutes.js';

const router = express.Router();

// Registro de rutas
router.use('/test', testRoutes);

export default router;
