/**
 * @swagger
 * components:
 *   schemas:
 *     TrainingPlan:
 *       type: object
 *       required:
 *         - name
 *         - startDate
 *         - endDate
 *       properties:
 *         id:
 *           type: string
 *           description: ID autogenerado del plan
 *         name:
 *           type: string
 *           description: Nombre del plan
 *         description:
 *           type: string
 *           description: Descripción detallada
 *         coach:
 *           type: string
 *           description: ID del entrenador dueño del plan
 *         athletes:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs de los atletas inscritos
 *         startDate:
 *           type: string
 *           format: date
 *           description: Fecha de inicio
 *         endDate:
 *           type: string
 *           format: date
 *           description: Fecha de fin
 *         isActive:
 *           type: boolean
 *           description: Estado del plan (Soft delete)
 */

/**
 * @swagger
 * tags:
 *   name: Training Plans
 *   description: Gestión de planes de entrenamiento
 */

/**
 * @swagger
 * /api/training/plans:
 *   post:
 *     summary: Crear un nuevo plan de entrenamiento
 *     tags: [Training Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TrainingPlan'
 *     responses:
 *       201:
 *         description: Plan creado con éxito
 *       403:
 *         description: No autorizado (Solo Coach o Admin)
 *
 *   get:
 *     summary: Obtener todos los planes activos
 *     tags: [Training Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de planes encontrados
 */

/**
 * @swagger
 * /api/training/plans/{id}:
 *   get:
 *     summary: Obtener un plan específico por su ID
 *     tags: [Training Plans]
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
 *         description: Datos del plan
 *       404:
 *         description: Plan no encontrado
 *
 *   put:
 *     summary: Actualizar un plan existente
 *     tags: [Training Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TrainingPlan'
 *     responses:
 *       200:
 *         description: Plan actualizado
 *       403:
 *         description: Permiso denegado
 *
 *   delete:
 *     summary: Archivar un plan (Soft Delete)
 *     tags: [Training Plans]
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
 *         description: Plan archivado con éxito
 */

/**
 * @swagger
 * /api/training/plans/athlete/{athleteId}:
 *   get:
 *     summary: Obtener planes asignados a un atleta
 *     tags: [Training Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de planes del atleta
 */

/**
 * @swagger
 * /api/training/plans/coach/{coachId}:
 *   get:
 *     summary: Obtener planes creados por un entrenador
 *     tags: [Training Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de planes del entrenador
 */

/**
 * @swagger
 * /api/training/plans/{id}/enroll:
 *   post:
 *     summary: Inscribir a un atleta en un plan
 *     tags: [Training Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: athleteId requerido si el que llama es Coach/Admin
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               athleteId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inscripción exitosa
 *       400:
 *         description: Error en la inscripción (ya inscrito o falta ID)
 */

import express from 'express';
import {
    createPlan,
    getAthletePlans,
    getCoachPlans,
    getPlanById,
    getPlanAthletesProgress,
    updatePlan,
    deletePlan,
    getAllActivePlans,
    enrollAthlete,
    duplicatePlan
} from '../controllers/planController.js';
import { protect, restrictTo, requireActiveMembership } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
    createPlanSchema,
    updatePlanSchema,
    enrollAthleteSchema,
    duplicatePlanSchema
} from '../schemas/planSchemas.js';
import chatRoutes from './chatRoutes.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

router.use('/:planId/chat', chatRoutes);

router.use(protect);
router.use(requireActiveMembership);

router.post('/', restrictTo(ROLES.COACH, ROLES.ADMIN), validate(createPlanSchema), createPlan);
router.get('/', getAllActivePlans);
router.get('/athlete/:athleteId', getAthletePlans);
router.get('/coach/:coachId', getCoachPlans);
router.get('/:id', getPlanById);
router.get('/:id/athletes-progress', restrictTo(ROLES.COACH, ROLES.ADMIN), getPlanAthletesProgress);
router.post('/:id/enroll', validate(enrollAthleteSchema), enrollAthlete);
router.post('/:id/duplicate', restrictTo(ROLES.COACH, ROLES.ADMIN), validate(duplicatePlanSchema), duplicatePlan);
router.put('/:id', restrictTo(ROLES.COACH, ROLES.ADMIN), validate(updatePlanSchema), updatePlan);
router.delete('/:id', restrictTo(ROLES.COACH, ROLES.ADMIN), deletePlan);

export default router;
