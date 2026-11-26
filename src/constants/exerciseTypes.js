/**
 * Categorías de ejercicio. Fuente única de verdad para evitar "magic strings"
 * repartidos por modelos y schemas: la usan los ejercicios de una sesión
 * (Workout) y la biblioteca de vídeos de técnica y fotos de ejercicio, que
 * comparten vocabulario para poder filtrar unos y otros por lo mismo.
 *
 * El orden sigue el de una sesión de entrenamiento (calentamiento primero,
 * estiramientos al final) porque es el que se usa para pintar los filtros.
 */
export const EXERCISE_TYPE = {
    WARMUP: 'warmup',           // calentamiento
    MOBILITY: 'mobility',       // movilidad articular
    STRENGTH: 'strength',       // fuerza
    ENDURANCE: 'endurance',     // resistencia
    CLIMBING: 'climbing',       // escalada
    TECHNIQUE: 'technique',     // técnica
    STRETCHING: 'stretching',   // estiramientos
    OTHER: 'other'              // no encaja en las anteriores
};

// Lista de todas las categorías válidas (para enums de Mongoose y de Zod).
export const ALL_EXERCISE_TYPES = Object.values(EXERCISE_TYPE);
