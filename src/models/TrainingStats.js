import mongoose from 'mongoose';

/**
 * Best Lift Schema
 * Almacena el mejor levantamiento (PR) para un ejercicio específico.
 */
const bestLiftSchema = new mongoose.Schema({
    exerciseName: {
        type: String,
        required: true
    },
    value: {
        type: String, // Usamos String para permitir cualquier unidad (ej: "100kg", "20 reps", "15:00 min")
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

/**
 * Training Stats Schema
 * Almacena estadísticas agregadas del entrenamiento del usuario.
 */
const trainingStatsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // Un usuario solo debe tener un documento de estadísticas
    },
    totalWorkouts: {
        type: Number,
        default: 0
    },
    totalExercises: {
        type: Number,
        default: 0
    },
    lastWorkoutDate: {
        type: Date
    },
    // Array de mejores marcas personales
    bestLifts: [bestLiftSchema],
    // Estado activo para soft delete
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const TrainingStats = mongoose.model('TrainingStats', trainingStatsSchema);

export default TrainingStats;
