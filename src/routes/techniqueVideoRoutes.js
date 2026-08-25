import express from 'express';
import {
    getAllVideos,
    getVideo,
    createVideo,
    updateVideo,
    deleteVideo
} from '../controllers/techniqueVideoController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createVideoSchema, updateVideoSchema } from '../schemas/videoSchemas.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: TechniqueVideos
 *   description: Gestión de la videoteca de técnica de ejercicios
 */

/**
 * @swagger
 * /api/technique-videos:
 *   get:
 *     summary: Obtiene todos los videos de técnica
 *     tags: [TechniqueVideos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de videos obtenida exitosamente
 *       401:
 *         description: No autorizado
 */
router.get('/', protect, getAllVideos);

/**
 * @swagger
 * /api/technique-videos/{id}:
 *   get:
 *     summary: Obtiene un video de técnica por ID
 *     tags: [TechniqueVideos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del video
 *     responses:
 *       200:
 *         description: Video obtenido exitosamente
 *       404:
 *         description: Video no encontrado
 */
router.get('/:id', protect, getVideo);

// A partir de aquí, solo administradores
router.use(protect, restrictTo(ROLES.ADMIN));

/**
 * @swagger
 * /api/technique-videos:
 *   post:
 *     summary: Añade un nuevo video de técnica
 *     tags: [TechniqueVideos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - videoUrl
 *             properties:
 *               title:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Video creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Prohibido (No es administrador)
 */
router.post('/', validate(createVideoSchema), createVideo);

/**
 * @swagger
 * /api/technique-videos/{id}:
 *   put:
 *     summary: Actualiza un video de técnica
 *     tags: [TechniqueVideos]
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
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Video actualizado exitosamente
 *       403:
 *         description: Prohibido (No es administrador)
 *       404:
 *         description: Video no encontrado
 */
router.put('/:id', validate(updateVideoSchema), updateVideo);

/**
 * @swagger
 * /api/technique-videos/{id}:
 *   delete:
 *     summary: Elimina un video de técnica
 *     tags: [TechniqueVideos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Video eliminado exitosamente
 *       403:
 *         description: Prohibido (No es administrador)
 *       404:
 *         description: Video no encontrado
 */
router.delete('/:id', deleteVideo);

export default router;
