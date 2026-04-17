import TrainingStats from '../models/TrainingStats.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

// Obtener progreso de un ejercicio específico (historial de logs)
export const getExerciseProgress = catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    const { exercise } = req.query;

    // Verificar permiso: solo el propio usuario, su coach o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'coach') {
        return next(new AppError('No tienes permiso para ver el progreso de este usuario', 403));
    }

    if (!exercise) {
        return next(new AppError('Se requiere el parámetro "exercise"', 400));
    }

    // Buscar logs del usuario que contengan el ejercicio
    const logs = await WorkoutLog.find({
        athlete: userId,
        isActive: true,
        'exercises.name': exercise
    })
        .select('date exercises')
        .sort({ date: 1 }); // Orden cronológico ascendente

    // Extraer los datos relevantes para la gráfica
    const progressData = logs.map(log => {
        const exerciseData = log.exercises.find(e => e.name === exercise);
        return {
            date: log.date,
            value: exerciseData ? exerciseData.load : null, // Asumimos load como valor principal, podría ser reps o algo compuesto
            reps: exerciseData ? exerciseData.reps : null,
            sets: exerciseData ? exerciseData.sets : null
        };
    }).filter(item => item.value !== null); // Filtrar si no hay datos

    res.status(200).json(progressData);
});

// Crear estadísticas iniciales para un usuario
export const createStats = catchAsync(async (req, res, next) => {
    const { userId } = req.body;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para crear estadísticas de otro usuario', 403));
    }

    const existingStats = await TrainingStats.findOne({ user: userId });
    if (existingStats) {
        return next(new AppError('El usuario ya tiene estadísticas registradas', 400));
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

// Obtener estadísticas de un usuario
export const getStats = catchAsync(async (req, res, next) => {
    const { userId } = req.params;

    // Verificar permiso: propio usuario, coach o admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'coach') {
        return next(new AppError('No tienes permiso para ver las estadísticas de este usuario', 403));
    }

    const stats = await TrainingStats.findOne({ user: userId });

    if (!stats) {
        return next(new AppError('Estadísticas no encontradas para este usuario', 404));
    }

    res.status(200).json(stats);
});

// Actualizar estadísticas (pueden ser contadores o nuevos PRs)
export const updateStats = catchAsync(async (req, res, next) => {
    const { userId } = req.params;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para modificar las estadísticas de otro usuario', 403));
    }

    const updates = req.body;

    const stats = await TrainingStats.findOneAndUpdate(
        { user: userId },
        updates,
        { new: true, runValidators: true }
    );

    if (!stats) {
        return next(new AppError('Estadísticas no encontradas', 404));
    }

    res.status(200).json(stats);
});

// Eliminar (soft delete) estadísticas de un usuario
export const deleteStats = catchAsync(async (req, res, next) => {
    const { userId } = req.params;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para eliminar las estadísticas de otro usuario', 403));
    }

    const stats = await TrainingStats.findOneAndUpdate(
        { user: userId },
        { isActive: false },
        { new: true }
    );

    if (!stats) {
        return next(new AppError('Estadísticas no encontradas', 404));
    }

    res.status(200).json({ message: 'Estadísticas desactivadas con éxito', stats });
});
