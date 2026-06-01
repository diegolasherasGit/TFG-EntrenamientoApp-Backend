import mongoose from 'mongoose';

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
    // Categoría del ejercicio — mismos valores que exerciseSchema en Workout.js
    // Permite filtrar la videoteca por tipo de ejercicio (opcional)
    exerciseType: {
        type: String,
        enum: ['strength', 'endurance', 'climbing', 'other'],
        default: null
    }
}, {
    timestamps: true
});

const TechniqueVideo = mongoose.model('TechniqueVideo', techniqueVideoSchema);

export default TechniqueVideo;
