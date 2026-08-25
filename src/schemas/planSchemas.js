import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID no válido');

// Límites de longitud para texto libre (defensa frente a cadenas enormes)
const NAME_MAX = 100;
const DESC_MAX = 1000;

const planName = z.string().min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(NAME_MAX, `El nombre no puede superar los ${NAME_MAX} caracteres`);
const planDescription = z.string()
    .max(DESC_MAX, `La descripción no puede superar los ${DESC_MAX} caracteres`);

export const createPlanSchema = z.object({
    body: z.object({
        name: z.string({ required_error: 'El nombre del plan es requerido' })
            .min(2, 'El nombre debe tener al menos 2 caracteres')
            .max(NAME_MAX, `El nombre no puede superar los ${NAME_MAX} caracteres`),
        description: planDescription.optional(),
        athleteIds: z.array(mongoId).optional(),
        startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
        endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
        coachId: mongoId.optional()
    })
});

export const updatePlanSchema = z.object({
    body: z.object({
        name: planName.optional(),
        description: planDescription.optional(),
        athleteIds: z.array(mongoId).optional(),
        startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
        endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
        coachId: mongoId.optional(),
        isActive: z.boolean().optional()
    })
});

export const enrollAthleteSchema = z.object({
    body: z.object({
        athleteId: mongoId.optional()
    })
});

export const duplicatePlanSchema = z.object({
    body: z.object({
        name: planName.optional(),
        startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
        endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional()
    })
});
