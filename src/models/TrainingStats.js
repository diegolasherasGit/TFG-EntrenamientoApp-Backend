import mongoose from 'mongoose';

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
