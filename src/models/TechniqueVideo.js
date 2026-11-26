import mongoose from 'mongoose';
import { ALL_EXERCISE_TYPES } from '../constants/exerciseTypes.js';

const techniqueVideoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'El título del video es obligatorio'],
        trim: true
    },
    videoUrl: {
        type: String,
        required: [true, 'La URL del video es obligatoria'],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    // Categoría del ejercicio (ver constants/exerciseTypes.js)
    // Permite filtrar la videoteca por tipo de ejercicio (opcional)
    exerciseType: {
        type: String,
        enum: ALL_EXERCISE_TYPES,
        default: null
    }
}, {
    timestamps: true
});

const TechniqueVideo = mongoose.model('TechniqueVideo', techniqueVideoSchema);

export default TechniqueVideo;
