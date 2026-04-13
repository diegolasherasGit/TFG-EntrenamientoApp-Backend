import WorkoutLog from '../models/logs/WorkoutLog.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';

export const logWorkoutResult = catchAsync(async (req, res) => {
    const { workoutId, athleteId, exercises, completed, notes, date } = req.body;
    const newLog = new WorkoutLog({ workout: workoutId, athlete: athleteId, exercises, completed, notes, date });
    await newLog.save();
    res.status(201).json({ message: 'Log de entrenamiento guardado', log: newLog });
});

export const getAthleteLogs = catchAsync(async (req, res) => {
    const { athleteId } = req.params;
    if (!req.query.sort) {
        req.query.sort = '-date';
    }

    const query = WorkoutLog.find({ athlete: athleteId }).populate('workout', 'name');
    const features = new ApiFeatures(query, req.query).filter().sort().limitFields().paginate();
    const logs = await features.query;
    const total = await WorkoutLog.countDocuments({ athlete: athleteId });

    res.status(200).json({ total, count: logs.length, logs });
});

export const updateLog = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { workoutId, athleteId, exercises, completed, notes, date, isActive } = req.body;

    const updatedLog = await WorkoutLog.findByIdAndUpdate(
        id,
        { workout: workoutId, athlete: athleteId, exercises, completed, notes, date, isActive },
        { new: true, runValidators: true }
    );

    if (!updatedLog) {
        return res.status(404).json({ message: 'Log no encontrado' });
    }

    res.status(200).json({ message: 'Log actualizado con éxito', log: updatedLog });
});

export const deleteLog = catchAsync(async (req, res) => {
    const { id } = req.params;
    const log = await WorkoutLog.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!log) {
        return res.status(404).json({ message: 'Log no encontrado' });
    }

    res.status(200).json({ message: 'Log de entrenamiento eliminado (soft delete)', log });
});
