import WorkoutLog from '../models/logs/WorkoutLog.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';

/**
 * Controller para el registro de ejecuciones (Logs)
 */

// Registrar ejecución de entrenamiento por un atleta
export const logWorkoutResult = async (req, res) => {
    try {
        const { workoutId, athleteId, exercises, completed, notes, date } = req.body;

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
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar el log', error: error.message });
    }
};

// Obtener historial de entrenamientos de un atleta (solo activos)
export const getAthleteLogs = catchAsync(async (req, res) => {
    const { athleteId } = req.params;

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
export const updateLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { workoutId, athleteId, exercises, completed, notes, date, isActive } = req.body;

        const updatedLog = await WorkoutLog.findByIdAndUpdate(
            id,
            {
                workout: workoutId,
                athlete: athleteId,
                exercises,
                completed,
                notes,
                date,
                isActive
            },
            { new: true, runValidators: true }
        );

        if (!updatedLog) {
            return res.status(404).json({ message: 'Log no encontrado' });
        }

        res.status(200).json({ message: 'Log actualizado con éxito', log: updatedLog });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el log', error: error.message });
    }
};

// Eliminar un log de entrenamiento (Soft Delete)
export const deleteLog = async (req, res) => {
    try {
        const { id } = req.params;
        const log = await WorkoutLog.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!log) {
            return res.status(404).json({ message: 'Log no encontrado' });
        }

        res.status(200).json({ message: 'Log de entrenamiento eliminado (soft delete)', log });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el log', error: error.message });
    }
};
