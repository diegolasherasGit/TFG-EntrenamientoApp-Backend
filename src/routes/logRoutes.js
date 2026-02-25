import express from 'express';
import {
    logWorkoutResult,
    getAthleteLogs,
    updateLog,
    deleteLog
} from '../controllers/logController.js';

const router = express.Router();

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
router.post('/', logWorkoutResult);

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
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WorkoutLog'
 */
router.get('/athlete/:athleteId', getAthleteLogs);

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
router.put('/:id', updateLog);

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
