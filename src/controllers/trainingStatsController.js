import TrainingStats from '../models/TrainingStats.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import catchAsync from '../utils/catchAsync.js';

export const getExerciseProgress = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { exercise } = req.query;

    if (!exercise) {
        return res.status(400).json({ message: 'Se requiere el parámetro "exercise"' });
    }

    const logs = await WorkoutLog.find({
        athlete: userId,
        'exercises.name': exercise
    })
    .select('date exercises')
    .sort({ date: 1 });

    const progressData = logs.map(log => {
        const exerciseData = log.exercises.find(e => e.name === exercise);
        return {
            date: log.date,
            value: exerciseData ? exerciseData.load : null,
            reps: exerciseData ? exerciseData.reps : null,
            sets: exerciseData ? exerciseData.sets : null
        };
    }).filter(item => item.value !== null);

    res.status(200).json(progressData);
});

export const createStats = catchAsync(async (req, res) => {
    const { userId } = req.body;

    const existingStats = await TrainingStats.findOne({ user: userId });
    if (existingStats) {
        return res.status(400).json({ message: 'El usuario ya tiene estadísticas registradas' });
    }

    const newStats = new TrainingStats({
        user: userId,
        totalWorkouts: 0,
        totalExercises: 0,
        bestLifts: []
    });

    await newStats.save();
    res.status(201).json(newStats);
});

export const getStats = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const stats = await TrainingStats.findOne({ user: userId });

    if (!stats) {
        return res.status(404).json({ message: 'Estadísticas no encontradas para este usuario' });
    }

    res.status(200).json(stats);
});

export const updateStats = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const updates = req.body;

    const stats = await TrainingStats.findOneAndUpdate(
        { user: userId },
        updates,
        { new: true, runValidators: true }
    );

    if (!stats) {
        return res.status(404).json({ message: 'Estadísticas no encontradas' });
    }

    res.status(200).json(stats);
});

export const deleteStats = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const stats = await TrainingStats.findOneAndUpdate(
        { user: userId },
        { isActive: false },
        { new: true }
    );

    if (!stats) {
        return res.status(404).json({ message: 'Estadísticas no encontradas' });
    }

    res.status(200).json({ message: 'Estadísticas desactivadas con éxito', stats });
});
