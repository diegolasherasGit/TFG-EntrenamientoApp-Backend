import { z } from 'zod';
import { ALL_EXERCISE_TYPES } from '../constants/exerciseTypes.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID no válido');

// Límites de longitud para texto libre (defensa frente a cadenas enormes)
const NAME_MAX = 100;
const NOTES_MAX = 2000;
const DATE_MAX = 40;     // strings de fecha/hora (ISO o "YYYY-MM-DD", "HH:mm")
const PARAM_MAX = 50;    // valores libres tipo "60kg", "30 min"
const EXERCISES_MAX = 100;

// Valor "libre" de un parámetro: string corto o número
const paramValue = z.union([z.string().max(PARAM_MAX, `El valor no puede superar los ${PARAM_MAX} caracteres`), z.number()]);

// Parámetros de un ejercicio: campos conocidos tipados + extras primitivos.
// Mantiene la flexibilidad (distintas métricas según el tipo) pero rechaza
// estructuras anidadas arbitrarias o valores con tipos incorrectos.
const exerciseParametersSchema = z.object({
    sets: z.number().int().positive().optional(),
    reps: z.number().int().positive().optional(),
    rpe: z.number().min(0).max(10).optional(),
    // load/weight/duration/distance/rest son valores "libres" en la app y el seed
    // (p. ej. "60kg", "0", "30 min", "bodyweight"), por eso se aceptan como string o
    // número. El modelo guarda parameters como Mixed, así que mantiene la flexibilidad.
    load: paramValue.optional(),
    weight: paramValue.optional(),
    duration: paramValue.optional(),
    distance: paramValue.optional(),
    rest: paramValue.optional()
}).catchall(z.union([z.string().max(PARAM_MAX), z.number(), z.boolean()]));

const exerciseSchema = z.object({
    name: z.string().min(1, 'El nombre del ejercicio es requerido')
        .max(NAME_MAX, `El nombre del ejercicio no puede superar los ${NAME_MAX} caracteres`),
    type: z.enum(ALL_EXERCISE_TYPES).optional(),
    parameters: exerciseParametersSchema.optional(),
    completed: z.boolean().optional(),
    notes: z.string().max(NOTES_MAX, `Las notas no pueden superar los ${NOTES_MAX} caracteres`).optional(),
    // Vídeo de técnica: el cliente puede mandar el id, el objeto poblado
    // (cuando reenvía los ejercicios tal y como los recibió) o null para quitarlo
    techniqueVideo: z.union([mongoId, z.looseObject({ _id: mongoId })]).nullable().optional(),
    // Foto del ejercicio: mismas formas aceptadas que techniqueVideo
    exercisePhoto: z.union([mongoId, z.looseObject({ _id: mongoId })]).nullable().optional()
});

export const createWorkoutSchema = z.object({
    body: z.object({
        planId: mongoId,
        name: z.string({ required_error: 'El nombre de la sesión es requerido' })
            .min(1, 'El nombre no puede estar vacío')
            .max(NAME_MAX, `El nombre no puede superar los ${NAME_MAX} caracteres`),
        date: z.string({ required_error: 'La fecha es requerida' }).max(DATE_MAX),
        time: z.string().max(DATE_MAX).optional(),
        estimatedDuration: z.number().positive().optional(),
        exercises: z.array(exerciseSchema).max(EXERCISES_MAX).optional()
    })
});

export const updateWorkoutSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'El nombre no puede estar vacío')
            .max(NAME_MAX, `El nombre no puede superar los ${NAME_MAX} caracteres`).optional(),
        date: z.string().max(DATE_MAX).optional(),
        time: z.string().max(DATE_MAX).optional(),
        estimatedDuration: z.number().positive().optional(),
        exercises: z.array(exerciseSchema).max(EXERCISES_MAX).optional(),
        isActive: z.boolean().optional()
    })
});

export const duplicateWorkoutSchema = z.object({
    body: z.object({
        date: z.string().max(DATE_MAX).optional(),
        time: z.string().max(DATE_MAX).optional(),
        planId: mongoId.optional()
    })
});
