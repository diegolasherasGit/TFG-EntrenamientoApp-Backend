/**
 * @swagger
 * components:
 *   schemas:
 *     Workout:
 *       type: object
 *       required:
 *         - name
 *         - planId
 *         - date
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         plan:
 *           type: string
 *           description: ID del plan al que pertenece
 *         date:
 *           type: string
 *           format: date
 *         exercises:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               sets:
 *                 type: number
 *               reps:
 *                 type: number
 */

/**
 * @swagger
 * tags:
 *   name: Workouts
 *   description: Gestión de sesiones de entrenamiento (Workouts)
 */

/**
 * @swagger
 * /api/training/workouts:
 *   post:
 *     summary: Crear una nueva sesión de entrenamiento
 *     tags: [Workouts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application_json:
 *           schema:
 *             $ref: '#/components/schemas/Workout'
 *     responses:
 *       201:
 *         description: Workout creado
 *       403:
 *         description: No autorizado
 *
 *   get:
 *     summary: Obtener todos los workouts (con filtros opcionales)
 *     tags: [Workouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de workouts
 */

/**
 * @swagger
 * /api/training/workouts/{id}:
 *   get:
 *     summary: Obtener un workout específico
 *     tags: [Workouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Datos del workout
 *
 *   put:
 *     summary: Actualizar un workout
 *     tags: [Workouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workout actualizado
 *
 *   delete:
 *     summary: Eliminar un workout
 *     tags: [Workouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workout eliminado
 */

/**
 * @swagger
 * /api/training/workouts/plan/{planId}:
 *   get:
 *     summary: Obtener todos los workouts asociados a un plan
 *     tags: [Workouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de workouts del plan
 */

/**
 * @swagger
 * /api/training/workouts/calendar/my-calendar:
 *   get:
 *     summary: Obtener los workouts del calendario del usuario actual
 *     tags: [Workouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Eventos de calendario del usuario
 */

import express from 'express';
import {
    createWorkout,
    getPlanWorkouts,
    getMyCalendarWorkouts,
    getWorkoutById,
    updateWorkout,
    deleteWorkout,
    duplicateWorkout,
    attendWorkout,
    unattendWorkout
} from '../controllers/workoutController.js';
import { protect, restrictTo, requireActiveMembership } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { ROLES } from '../constants/roles.js';
import {
    createWorkoutSchema,
    updateWorkoutSchema,
    duplicateWorkoutSchema
} from '../schemas/workoutSchemas.js';

const router = express.Router();

router.use(protect);
router.use(requireActiveMembership);

router.post('/', restrictTo(ROLES.COACH, ROLES.ADMIN), validate(createWorkoutSchema), createWorkout);
router.get('/plan/:planId', getPlanWorkouts);
router.get('/calendar/my-calendar', getMyCalendarWorkouts);
router.get('/:id', getWorkoutById);
// El atleta se apunta / desapunta de una sesión (asistencia previa)
router.post('/:id/attend', attendWorkout);
router.delete('/:id/attend', unattendWorkout);
router.post('/:id/duplicate', restrictTo(ROLES.COACH, ROLES.ADMIN), validate(duplicateWorkoutSchema), duplicateWorkout);
router.put('/:id', restrictTo(ROLES.COACH, ROLES.ADMIN), validate(updateWorkoutSchema), updateWorkout);
router.delete('/:id', restrictTo(ROLES.COACH, ROLES.ADMIN), deleteWorkout);

export default router;
