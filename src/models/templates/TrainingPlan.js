import mongoose from 'mongoose';
import User from '../User.js';

/**
 * Training Plan Schema (Plantilla Maestra)
 * Define un plan de entrenamiento de alto nivel creado por un coach para uno o varios atletas.
 */
const trainingPlanSchema = new mongoose.Schema({
    // Título descriptivo del plan
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Detalles adicionales sobre los objetivos del plan
    description: {
        type: String,
        trim: true
    },
    // Referencia al usuario con rol 'coach' que diseñó el plan
    coach: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        validate: {
            validator: async function (v) {
                const user = await User.findById(v);
                return user && user.role === 'coach';
            },
            message: 'El usuario asignado debe tener el rol de "coach".'
        }
    },
    // Lista de atletas que están siguiendo este plan actualmente
    athletes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Fecha de inicio del ciclo de entrenamiento
    startDate: {
        type: Date,
        required: true
    },
    // Fecha estimada de finalización del ciclo
    endDate: {
        type: Date,
        required: true
    },
    // Estado del plan: true si está activo, false si ha sido borrado/archivado
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    // Timestamps para rastrear la creación y última modificación del plan
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual para obtener los workouts asociados a este plan
trainingPlanSchema.virtual('workouts', {
    ref: 'Workout',
    localField: '_id',
    foreignField: 'plan'
});

const TrainingPlan = mongoose.model('TrainingPlan', trainingPlanSchema);

export default TrainingPlan;
