import express from 'express';
import {
    getAllPhotos,
    getPhoto,
    createPhoto,
    updatePhoto,
    deletePhoto
} from '../controllers/exercisePhotoController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createPhotoSchema, updatePhotoSchema } from '../schemas/photoSchemas.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// Lectura: cualquier usuario autenticado (coach elige, atleta visualiza)
router.get('/', protect, getAllPhotos);
router.get('/:id', protect, getPhoto);

// Gestión: solo administradores (igual que la videoteca de técnica)
router.use(protect, restrictTo(ROLES.ADMIN));
router.post('/', validate(createPhotoSchema), createPhoto);
router.put('/:id', validate(updatePhotoSchema), updatePhoto);
router.delete('/:id', deletePhoto);

export default router;
