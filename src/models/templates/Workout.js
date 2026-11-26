import mongoose from 'mongoose';
import { ALL_EXERCISE_TYPES, EXERCISE_TYPE } from '../../constants/exerciseTypes.js';

/**
 * Exercise Schema (Sub-documento)
 * Define la estructura de un ejercicio individual dentro de una sesión.
 */
const exerciseSchema = new mongoose.Schema({
    // Nombre del ejercicio (ej: "Sentadillas")
    name: {
        type: String,
        required: true
    },
    // Categoría del ejercicio
    type: {
        type: String,
        enum: ALL_EXERCISE_TYPES,
        default: EXERCISE_TYPE.STRENGTH
    },
    // Parámetros flexibles (series, repeticiones, RPE, etc.)
    // Se usa Mixed para permitir diferentes estructuras según el tipo de ejercicio
    parameters: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Estado de la plantilla (por defecto no completado)
    completed: {
        type: Boolean,
        default: false
    },
    // Instrucciones o notas específicas del coach para este ejercicio
    notes: {
        type: String,
        trim: true
    },
    // Vídeo de la videoteca que muestra la técnica del ejercicio (opcional)
    techniqueVideo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TechniqueVideo',
        default: null
    },
    // Foto de la biblioteca del admin que ilustra el ejercicio (opcional)
    exercisePhoto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExercisePhoto',
        default: null
    }
});

/**
 * Workout Schema (Plantilla de Sesión)
 * Define una sesión de entrenamiento específica que forma parte de un plan.
 * Actúa como el "molde" que luego el atleta registrará en su WorkoutLog.
 */
const workoutSchema = new mongoose.Schema({
    // Plan al que pertenece esta sesión
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainingPlan',
        required: true
    },
    // Fecha programada para realizar la sesión
    date: {
        type: Date,
        required: true
    },
    // Hora programada para realizar la sesión
    time: {
        type: String,
        default: '00:00'
    },
    // Nombre de la sesión (ej: "Día de Fuerza - Empuje")
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Duración estimada de la sesión en minutos
    estimatedDuration: {
        type: Number,
        default: 60
    },
    // Lista de ejercicios embebidos
    exercises: [exerciseSchema],
    // Atletas del plan que se han apuntado para asistir a esta sesión
    attendees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Indica si la plantilla general está marcada como "lista" o "completada"
    completed: {
        type: Boolean,
        default: false
    },
    // Observaciones generales del coach para la sesión
    notes: {
        type: String,
        trim: true
    },
    // Estado de la sesión: true si está activa, false si ha sido borrada/desactivada
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    // Registra creación y edición de la plantilla
    timestamps: true
});

// Índice para las queries frecuentes: sesiones por plan (activas) ordenadas por fecha
// Sirve también para el calendario, que filtra por plan: { $in: [...] }
workoutSchema.index({ plan: 1, isActive: 1, date: 1 });

const Workout = mongoose.model('Workout', workoutSchema);

export default Workout;
