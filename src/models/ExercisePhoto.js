import mongoose from 'mongoose';

/**
 * Foto de ejercicio de la biblioteca del admin.
 * El coach las asocia a los ejercicios de una sesión para que el atleta
 * vea la postura/colocación mientras entrena (análogo a TechniqueVideo).
 */
const exercisePhotoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'El título de la foto es obligatorio'],
        trim: true
    },
    // URL servida desde /uploads (subida del admin) o externa
    imageUrl: {
        type: String,
        required: [true, 'La imagen es obligatoria'],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    // Categoría del ejercicio — mismos valores que exerciseSchema en Workout.js
    exerciseType: {
        type: String,
        enum: ['strength', 'endurance', 'climbing', 'other'],
        default: null
    }
}, {
    timestamps: true
});

const ExercisePhoto = mongoose.model('ExercisePhoto', exercisePhotoSchema);

export default ExercisePhoto;
