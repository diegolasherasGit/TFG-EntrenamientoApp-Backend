import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID no válido');

// Límites de longitud para texto libre (defensa frente a cadenas enormes)
const NAME_MAX = 100;
const NOTES_MAX = 2000;
const DATE_MAX = 40;
const PARAM_MAX = 50;
const EXERCISES_MAX = 100;

const paramValue = z.union([z.string().max(PARAM_MAX), z.number()]);

// Ejercicio tal y como lo envía la app al completar un entreno. Es permisivo
// (acepta campos extra con .catchall) para no romper la forma del payload, pero
// acota los textos libres (nombre, notas y valores como "60kg") y los numéricos.
const logExerciseSchema = z.object({
    name: z.string().max(NAME_MAX, `El nombre del ejercicio no puede superar los ${NAME_MAX} caracteres`).optional(),
    trackingType: z.string().max(PARAM_MAX).optional(),
    sets: paramValue.optional(),
    reps: paramValue.optional(),
    duration: paramValue.optional(),
    distance: paramValue.optional(),
    load: paramValue.optional(),
    completed: z.boolean().optional(),
    notes: z.string().max(NOTES_MAX, `Las notas no pueden superar los ${NOTES_MAX} caracteres`).optional()
}).catchall(z.union([z.string().max(NOTES_MAX), z.number(), z.boolean(), z.null()]));

export const createLogSchema = z.object({
    body: z.object({
        workoutId: mongoId,
        // athleteId puede venir del cliente pero el controller lo ignora y usa req.user
        athleteId: mongoId.optional(),
        completed: z.boolean().optional(),
        notes: z.string().max(NOTES_MAX, `Las notas no pueden superar los ${NOTES_MAX} caracteres`).optional(),
        date: z.string().max(DATE_MAX).optional(),
        exercises: z.array(logExerciseSchema).max(EXERCISES_MAX).optional()
    })
});

export const updateLogSchema = z.object({
    body: z.object({
        completed: z.boolean().optional(),
        notes: z.string().max(NOTES_MAX, `Las notas no pueden superar los ${NOTES_MAX} caracteres`).optional(),
        date: z.string().max(DATE_MAX).optional(),
        exercises: z.array(logExerciseSchema).max(EXERCISES_MAX).optional()
    })
});
