import mongoose from 'mongoose';

/**
 * Exercise Log Schema (Sub-documento de registro)
 * Almacena los resultados reales obtenidos por el atleta tras realizar el ejercicio.
 */
const exerciseLogSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    // Cantidad de series realizadas finalmente
    sets: Number,
    // Repeticiones registradas por el atleta
    reps: Number,
    // Carga utilizada (ej: "80kg", "15lbs", "BW")
    load: String,
    // Feedback del atleta sobre si logró el objetivo
    completed: {
        type: Boolean,
        default: false
    },
    // Comentarios del atleta sobre sensaciones, fallos técnicos, etc.
    notes: String
});

/**
 * Workout Log Schema (Registro de ejecución)
 * Representa la realización real de un entrenamiento por parte de un atleta específico.
 */
const workoutLogSchema = new mongoose.Schema({
    // Atleta que ejecutó la sesión
    athlete: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Referencia a la sesión maestra que sirve de base
    workout: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workout',
        required: true
    },
    // Fecha y hora real en la que se registró el entrenamiento
    date: {
        type: Date,
        default: Date.now
    },
    // Resultados específicos de cada ejercicio
    exercises: [exerciseLogSchema],
    // Estado final de la sesión según el atleta
    completed: {
        type: Boolean,
        default: false
    },
    // Notas generales del atleta sobre el entrenamiento completo
    notes: String,
    // Estado del registro: true si es válido, false si ha sido "borrado" por el usuario
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    // Timestamps para auditoría de registros
    timestamps: true
});

// Índices para las queries frecuentes: registros por atleta (activos) y por sesión maestra
workoutLogSchema.index({ athlete: 1, isActive: 1 });
workoutLogSchema.index({ workout: 1 });

const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);

export default WorkoutLog;
