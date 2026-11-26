import { z } from 'zod';
import { ALL_EXERCISE_TYPES } from '../constants/exerciseTypes.js';

// Límites de longitud para texto libre (defensa frente a cadenas enormes)
const TITLE_MAX = 100;
const DESC_MAX = 1000;
const URL_MAX = 2048;

export const createVideoSchema = z.object({
    body: z.object({
        title: z.string({ required_error: 'El título es requerido' })
            .min(2, 'El título debe tener al menos 2 caracteres')
            .max(TITLE_MAX, `El título no puede superar los ${TITLE_MAX} caracteres`),
        videoUrl: z.string({ required_error: 'La URL del video es requerida' })
            .max(URL_MAX, `La URL no puede superar los ${URL_MAX} caracteres`)
            .url('La URL del video no es válida'),
        description: z.string().max(DESC_MAX, `La descripción no puede superar los ${DESC_MAX} caracteres`).optional(),
        exerciseType: z.enum(ALL_EXERCISE_TYPES).optional()
    })
});

export const updateVideoSchema = z.object({
    body: z.object({
        title: z.string().min(2).max(TITLE_MAX, `El título no puede superar los ${TITLE_MAX} caracteres`).optional(),
        videoUrl: z.string().max(URL_MAX).url('La URL del video no es válida').optional(),
        description: z.string().max(DESC_MAX, `La descripción no puede superar los ${DESC_MAX} caracteres`).optional(),
        exerciseType: z.enum(ALL_EXERCISE_TYPES).optional()
    })
});
