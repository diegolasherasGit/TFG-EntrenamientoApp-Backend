import express from 'express';
import {
    createWorkout,
    getPlanWorkouts,
    updateWorkout,
    deleteWorkout
} from '../controllers/workoutController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Workout:
 *       type: object
 *       required:
 *         - planId
 *         - date
 *         - name
 *       properties:
 *         id:
 *           type: string
 *         plan:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         name:
 *           type: string
 *         exercises:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Exercise'
 *         isActive:
 *           type: boolean
 *           description: Indica si la sesión está activa
 *     Exercise:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name: { type: string }
 *         sets: { type: number }
 *         reps: { type: number }
 *         load: { type: string }
 *         completed: { type: boolean }
 *         notes: { type: string }
 */

/**
 * @swagger
 * tags:
 *   name: Training Workouts
 *   description: Gestión de sesiones de entrenamiento
 */

/**
 * @swagger
 * /api/training/workouts:
 *   post:
 *     summary: Crear una sesión de entrenamiento maestro (Plantilla)
 *     tags: [Training Workouts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, date, name]
 *             properties:
 *               planId: { type: string }
 *               date: { type: string, format: date }
 *               name: { type: string }
 *               exercises: 
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Exercise'
 *     responses:
 *       201:
 *         description: Sesión creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workout'
 */
router.post('/', createWorkout);

/**
 * @swagger
 * /api/training/workouts/plan/{planId}:
 *   get:
 *     summary: Obtener sesiones de un plan
 *     tags: [Training Workouts]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de sesiones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Workout'
 */
router.get('/plan/:planId', getPlanWorkouts);

/**
 * @swagger
 * /api/training/workouts/{id}:
 *   put:
 *     summary: Actualizar una sesión de entrenamiento
 *     tags: [Training Workouts]
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
 *             $ref: '#/components/schemas/Workout'
 *     responses:
 *       200:
 *         description: Sesión actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workout'
 *       404:
 *         description: Sesión no encontrada
 */
router.put('/:id', updateWorkout);

/**
 * @swagger
 * /api/training/workouts/{id}:
 *   delete:
 *     summary: Eliminar una sesión de entrenamiento (Soft Delete)
 *     tags: [Training Workouts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sesión eliminada correctamente
 *       404:
 *         description: Sesión no encontrada
 *     security: []
 */
router.delete('/:id', deleteWorkout);

export default router;
