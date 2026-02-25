import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    sets: {
        type: Number,
        default: 0
    },
    reps: {
        type: Number,
        default: 0
    },
    load: {
        type: String, // Can be weight (kg), %RPE, etc.
        default: '0'
    },
    completed: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        trim: true
    }
});

const workoutSchema = new mongoose.Schema({
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainingPlan',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    exercises: [exerciseSchema],
    completed: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const Workout = mongoose.model('Workout', workoutSchema);

export default Workout;
