/**
 * Rutas de prueba para verificar la conectividad y funcionamiento básico de la API.
 */
import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Ruta de prueba del API
 *     description: Devuelve un mensaje de confirmación para verificar que el router de test está activo.
 *     responses:
 *       200:
 *         description: El router de test funciona correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: API de test funcionando correctamente
 */
router.get('/', (req, res) => {
    res.status(200).json({ message: 'API de test funcionando correctamente' });
});

export default router;
