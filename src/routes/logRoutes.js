import express from 'express';
import {
    logWorkoutResult,
    getAthleteLogs,
    updateLog,
    deleteLog,
    exportCoachAthleteLogs
} from '../controllers/logController.js';
import { protect, requireActiveMembership, restrictTo } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createLogSchema, updateLogSchema } from '../schemas/logSchemas.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(protect);
router.use(requireActiveMembership);

/**
 * @swagger
 * components:
 *   schemas:
 *     WorkoutLog:
 *       type: object
 *       required:
 *         - athleteId
 *         - workoutId
 *       properties:
 *         id:
 *           type: string
 *         athlete:
 *           type: string
 *         workout:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         exercises:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Exercise'
 *         completed:
 *           type: boolean
 *         notes:
 *           type: string
 *         isActive:
 *           type: boolean
 *           description: Indica si el log está activo
 */

/**
 * @swagger
 * tags:
 *   name: Training Logs
 *   description: Historial de entrenamientos
 */

/**
 * @swagger
 * /api/training/logs:
 *   post:
 *     summary: Registrar ejecución de entrenamiento por un atleta
 *     tags: [Training Logs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workoutId, athleteId]
 *             properties:
 *               workoutId: { type: string }
 *               athleteId: { type: string }
 *               exercises: { type: array, items: { $ref: '#/components/schemas/Exercise' } }
 *               completed: { type: boolean }
 *               notes: { type: string }
 *               date: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Log guardado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkoutLog'
 */
router.post('/', validate(createLogSchema), logWorkoutResult);

/**
 * @swagger
 * /api/training/logs/athlete/{athleteId}:
 *   get:
 *     summary: Obtener historial de entrenamientos de un atleta
 *     tags: [Training Logs]
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: number }
 *                 count: { type: number }
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkoutLog'
 */
router.get('/athlete/:athleteId', getAthleteLogs);

/**
 * @swagger
 * /api/training/logs/export/coach:
 *   get:
 *     summary: Exportar a Excel los registros de todos los atletas del coach autenticado
 *     tags: [Training Logs]
 *     responses:
 *       200:
 *         description: Fichero .xlsx con un registro por ejercicio
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet: {}
 *       404:
 *         description: El coach no tiene atletas inscritos en sus planes
 */
router.get('/export/coach', restrictTo(ROLES.COACH), exportCoachAthleteLogs);

/**
 * @swagger
 * /api/training/logs/{id}:
 *   put:
 *     summary: Actualizar un log de entrenamiento
 *     tags: [Training Logs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkoutLog'
 *     responses:
 *       200:
 *         description: Log actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkoutLog'
 *       404:
 *         description: Log no encontrado
 */
router.put('/:id', validate(updateLogSchema), updateLog);

/**
 * @swagger
 * /api/training/logs/{id}:
 *   delete:
 *     summary: Eliminar un log de entrenamiento (Soft Delete)
 *     tags: [Training Logs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Log eliminado correctamente
 *       404:
 *         description: Log no encontrado
 *     security: []
 */
router.delete('/:id', deleteLog);

export default router;
