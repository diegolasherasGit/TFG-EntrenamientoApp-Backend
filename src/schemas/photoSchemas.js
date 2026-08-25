import { z } from 'zod';

// Límites de longitud para texto libre (defensa frente a cadenas enormes)
const TITLE_MAX = 100;
const DESC_MAX = 1000;

export const createPhotoSchema = z.object({
    body: z.object({
        title: z.string({ required_error: 'El título es requerido' })
            .min(2, 'El título debe tener al menos 2 caracteres')
            .max(TITLE_MAX, `El título no puede superar los ${TITLE_MAX} caracteres`),
        // La imagen llega en base64 desde la app (igual que la foto de perfil).
        // El tamaño máximo real lo impone el límite del body parser (1mb).
        photoBase64: z.string({ required_error: 'La imagen es requerida' })
            .min(1, 'La imagen no puede estar vacía'),
        mimeType: z.enum(['image/jpeg', 'image/png']),
        description: z.string().max(DESC_MAX, `La descripción no puede superar los ${DESC_MAX} caracteres`).optional(),
        exerciseType: z.enum(['strength', 'endurance', 'climbing', 'other']).optional()
    })
});

export const updatePhotoSchema = z.object({
    body: z.object({
        title: z.string().min(2, 'El título debe tener al menos 2 caracteres')
            .max(TITLE_MAX, `El título no puede superar los ${TITLE_MAX} caracteres`).optional(),
        description: z.string().max(DESC_MAX, `La descripción no puede superar los ${DESC_MAX} caracteres`).optional(),
        exerciseType: z.enum(['strength', 'endurance', 'climbing', 'other']).optional()
    })
});
