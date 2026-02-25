import express from 'express';
import {
    createPlan,
    getAthletePlans,
    getCoachPlans,
    updatePlan,
    deletePlan
} from '../controllers/planController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TrainingPlan:
 *       type: object
 *       required:
 *         - name
 *         - coachId
 *         - startDate
 *         - endDate
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         coach:
 *           type: string
 *         athletes:
 *           type: array
 *           items:
 *             type: string
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         isActive:
 *           type: boolean
 *           description: Indica si el plan está activo
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
 *     summary: Crear un nuevo plan de entrenamiento (Plantilla)
 *     tags: [Training Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, coachId, startDate, endDate]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               athleteIds: 
 *                 type: array
 *                 items: { type: string }
 *               coachId: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Plan creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainingPlan'
 */
router.post('/', createPlan);

/**
 * @swagger
 * /api/training/plans/athlete/{athleteId}:
 *   get:
 *     summary: Obtener planes asignados a un atleta
 *     tags: [Training Plans]
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de planes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TrainingPlan'
 */
router.get('/athlete/:athleteId', getAthletePlans);

/**
 * @swagger
 * /api/training/plans/coach/{coachId}:
 *   get:
 *     summary: Obtener planes creados por un entrenador
 *     tags: [Training Plans]
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de planes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TrainingPlan'
 */
router.get('/coach/:coachId', getCoachPlans);

/**
 * @swagger
 * /api/training/plans/{id}:
 *   put:
 *     summary: Actualizar un plan de entrenamiento
 *     tags: [Training Plans]
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
 *             $ref: '#/components/schemas/TrainingPlan'
 *     responses:
 *       200:
 *         description: Plan actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainingPlan'
 *       404:
 *         description: Plan no encontrado
 */
router.put('/:id', updatePlan);

/**
 * @swagger
 * /api/training/plans/{id}:
 *   delete:
 *     summary: Archivar un plan de entrenamiento (Soft Delete)
 *     tags: [Training Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan archivado correctamente
 *       404:
 *         description: Plan no encontrado
 *     security: []
 */
router.delete('/:id', deletePlan);

export default router;
