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
 */

/**
 * @swagger
 * pins:
 *   name: Training Plans
 *   description: Gestión de planes de entrenamiento
 */

/**
 * @swagger
 * /api/training/plans:
 *   post:
 *     summary: Crear un nuevo plan de entrenamiento
 *     tags: [Training Plans]
 *     responses:
 *       201:
 *         description: Plan creado
 */

/**
 * @swagger
 * /api/training/plans:
 *   get:
 *     summary: Obtener todos los planes activos
 *     tags: [Training Plans]
 *     responses:
 *       200:
 *         description: Lista de planes
 */
