/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: string
 *           description: ID autogenerado de MongoDB
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         role:
 *           type: string
 *           enum: [athlete, coach, admin]
 *         isActive:
 *           type: boolean
 *         isVerified:
 *           type: boolean
 *           description: Indica si el email ha sido verificado mediante OTP
 *         photo:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestión de usuarios y perfiles
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Registrar un nuevo atleta
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente, pero retenido hasta verificación
 *       400:
 *         description: El usuario ya existe o datos inválidos
 */

/**
 * @swagger
 * /api/users/verify-email:
 *   post:
 *     summary: Verificar cuenta de correo usando código OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string }
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Email verificado con éxito
 *       400:
 *         description: Código inválido o expirado
 */

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Iniciar sesión (Tradicional)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales incorrectas
 */

/**
 * @swagger
 * /api/users/google-login:
 *   post:
 *     summary: Iniciar sesión o registrarse con Google
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string }
 *     responses:
 *       200:
 *         description: Login con Google exitoso
 */

/**
 * @swagger
 * /api/users/profile/{id}:
 *   get:
 *     summary: Obtener perfil de usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Datos del perfil
 *
 *   put:
 *     summary: Actualizar perfil de usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               oldPassword: { type: string }
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *
 *   delete:
 *     summary: Desactivar cuenta (Soft Delete)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cuenta desactivada
 */

/**
 * @swagger
 * /api/users/profile/{id}/photo:
 *   post:
 *     summary: Subir o actualizar foto de perfil (Base64)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *             type: object
 *             required: [photoBase64, mimeType]
 *             properties:
 *               photoBase64: { type: string }
 *               mimeType: { type: string, enum: ['image/jpeg', 'image/png'] }
 *     responses:
 *       200:
 *         description: Foto actualizada
 *
 *   delete:
 *     summary: Eliminar foto de perfil
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Foto eliminada
 */

/**
 * @swagger
 * /api/users/create-privileged:
 *   post:
 *     summary: Crear usuario con rol privilegiado (Solo Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Usuario privilegiado creado
 *       403:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/users/restore/{id}:
 *   post:
 *     summary: Restaurar una cuenta desactivada (Solo Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cuenta restaurada
 */

import express from 'express';
import {
    register,
    verifyEmail,
    forgotPassword,
    resetPassword,
    login,
    getProfile,
    updateUser,
    deleteUser,
    googleLogin,
    restoreUser,
    createPrivilegedUser,
    getDeletedUsers,
    uploadPhoto,
    removePhoto
} from '../controllers/userController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/login', login);
router.post('/google-login', googleLogin);

router.get('/profile/:id', protect, getProfile);
router.put('/profile/:id', protect, updateUser);
router.delete('/profile/:id', protect, deleteUser);

router.get('/deleted', protect, restrictTo('admin'), getDeletedUsers);
router.patch('/profile/:id/restore', protect, restrictTo('admin'), restoreUser);
router.post('/privileged', protect, restrictTo('admin'), createPrivilegedUser);

router.post('/profile/:id/photo', protect, uploadPhoto);
router.delete('/profile/:id/photo', protect, removePhoto);

export default router;
