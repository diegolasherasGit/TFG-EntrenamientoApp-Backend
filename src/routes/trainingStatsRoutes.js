import express from 'express';
import {
    createStats,
    getStats,
    updateStats,
    deleteStats,
    getExerciseProgress,
    getDashboardStats,
} from '../controllers/trainingStatsController.js';
import { protect, requireActiveMembership } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(requireActiveMembership);

/**
 * @swagger
 * /api/training/stats/dashboard:
 *   get:
 *     summary: Estadísticas del panel según el rol del usuario autenticado
 *     tags: [Training Stats]
 *     responses:
 *       200:
 *         description: Métricas y datos para gráficas (atleta, coach o admin)
 */
router.get('/dashboard', getDashboardStats);

/**
 * @swagger
 * /api/training/stats/progress/{userId}:
 *   get:
 *     summary: Obtener historial de progreso de un ejercicio para gráficas
 *     tags: [Training Stats]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: exercise
 *         required: true
 *         schema: { type: string }
 *         description: Nombre del ejercicio a consultar
 *     responses:
 *       200:
 *         description: Historial de progreso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date: { type: string, format: date }
 *                   value: { type: string }
 *                   reps: { type: number }
 *                   sets: { type: number }
 *       400:
 *         description: Falta parámetro exercise
 */
router.get('/progress/:userId', getExerciseProgress);

/**
 * @swagger
 * components:
 *   schemas:
 *     TrainingStats:
 *       type: object
 *       required:
 *         - user
 *       properties:
 *         user:
 *           type: string
 *           description: ID del usuario
 *         totalWorkouts:
 *           type: number
 *           default: 0
 *         totalExercises:
 *           type: number
 *           default: 0
 *         lastWorkoutDate:
 *           type: string
 *           format: date
 */

/**
 * @swagger
 * tags:
 *   name: Training Stats
 *   description: Estadísticas de entrenamiento del usuario
 */

/**
 * @swagger
 * /api/training/stats:
 *   post:
 *     summary: Inicializar estadísticas para un usuario (uso manual, normalmente auto)
 *     tags: [Training Stats]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Estadísticas creadas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainingStats'
 *       400:
 *         description: El usuario ya tiene estadísticas
 */
router.post('/', createStats);

/**
 * @swagger
 * /api/training/stats/user/{userId}:
 *   get:
 *     summary: Obtener estadísticas de un usuario por su ID
 *     tags: [Training Stats]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Estadísticas del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainingStats'
 *       404:
 *         description: Estadísticas no encontradas
 */
router.get('/user/:userId', getStats);

/**
 * @swagger
 * /api/training/stats/user/{userId}:
 *   put:
 *     summary: Actualizar estadísticas de un usuario
 *     tags: [Training Stats]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalWorkouts: { type: number }
 *               totalExercises: { type: number }
 *               lastWorkoutDate: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Estadísticas actualizadas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainingStats'
 *       404:
 *         description: Estadísticas no encontradas
 */
router.put('/user/:userId', updateStats);

/**
 * @swagger
 * /api/training/stats/user/{userId}:
 *   delete:
 *     summary: Realizar soft delete de las estadísticas de un usuario
 *     tags: [Training Stats]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Estadísticas desactivadas con éxito
 *       404:
 *         description: Estadísticas no encontradas
 */
router.delete('/user/:userId', deleteStats);

export default router;
