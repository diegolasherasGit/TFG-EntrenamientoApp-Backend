import WorkoutLog from '../models/logs/WorkoutLog.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import AppError from '../utils/AppError.js';

/**
 * Controller para el registro de ejecuciones (Logs)
 */

// Registrar ejecución de entrenamiento por un atleta
export const logWorkoutResult = catchAsync(async (req, res) => {
    const { workoutId, exercises, completed, notes, date } = req.body;

    // Forzar athleteId desde el usuario autenticado para evitar suplantación
    const athleteId = req.user._id;

    const newLog = new WorkoutLog({
        workout: workoutId,
        athlete: athleteId,
        exercises,
        completed,
        notes,
        date
    });

    await newLog.save();
    res.status(201).json({ message: 'Log de entrenamiento guardado', log: newLog });
});

// Obtener historial de entrenamientos de un atleta (solo activos)
export const getAthleteLogs = catchAsync(async (req, res, next) => {
    const { athleteId } = req.params;

    // Verificar permiso: solo el propio atleta, su coach o un admin
    if (req.user._id.toString() !== athleteId && req.user.role !== 'admin' && req.user.role !== 'coach') {
        return next(new AppError('No tienes permiso para ver los logs de este atleta', 403));
    }

    // Sort por defecto: el día más reciente primero
    if (!req.query.sort) {
        req.query.sort = '-date';
    }

    const query = WorkoutLog.find({
        athlete: athleteId,
        isActive: true
    }).populate('workout', 'name');

    const features = new ApiFeatures(query, req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const logs = await features.query;
    const total = await WorkoutLog.countDocuments({ athlete: athleteId, isActive: true });

    res.status(200).json({
        total,
        count: logs.length,
        logs
    });
});

// Actualizar un log de entrenamiento
export const updateLog = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { workoutId, exercises, completed, notes, date, isActive } = req.body;

    const log = await WorkoutLog.findById(id);
    if (!log) {
        return next(new AppError('Log no encontrado', 404));
    }

    // Verificar permiso: solo el atleta dueño del log o un admin
    if (req.user._id.toString() !== log.athlete.toString() && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para modificar este log', 403));
    }

    const updatedLog = await WorkoutLog.findByIdAndUpdate(
        id,
        {
            workout: workoutId,
            exercises,
            completed,
            notes,
            date,
            isActive
        },
        { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'Log actualizado con éxito', log: updatedLog });
});

// Eliminar un log de entrenamiento (Soft Delete)
export const deleteLog = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const log = await WorkoutLog.findById(id);
    if (!log) {
        return next(new AppError('Log no encontrado', 404));
    }

    // Verificar permiso: solo el atleta dueño del log o un admin
    if (req.user._id.toString() !== log.athlete.toString() && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para eliminar este log', 403));
    }

    log.isActive = false;
    await log.save();

    res.status(200).json({ message: 'Log de entrenamiento eliminado (soft delete)', log });
});
