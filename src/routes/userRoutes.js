import express from 'express';
import { register, getProfile, updateUser, deleteUser } from '../controllers/userController.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [coach, athlete]
 *     responses:
 *       201:
 *         description: Usuario registrado con éxito
 *       400:
 *         description: El usuario ya existe
 */
router.post('/register', register);

/**
 * @swagger
 * /api/users/profile/{id}:
 *   get:
 *     summary: Obtener el perfil de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Perfil del usuario encontrado
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/profile/:id', getProfile);

/**
 * @swagger
 * /api/users/profile/{id}:
 *   put:
 *     summary: Actualizar el perfil de un usuario
 *     tags: [Users]
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
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [coach, athlete]
 *     responses:
 *       200:
 *         description: Usuario actualizado con éxito
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/profile/:id', updateUser);

/**
 * @swagger
 * /api/users/profile/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario eliminado con éxito
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/profile/:id', deleteUser);

export default router;
