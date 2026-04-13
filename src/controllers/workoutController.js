import Workout from '../models/templates/Workout.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';

export const createWorkout = catchAsync(async (req, res) => {
    const { planId, date, name, exercises } = req.body;
    const newWorkout = new Workout({ plan: planId, date, name, exercises });
    await newWorkout.save();
    res.status(201).json({ message: 'Sesión de entrenamiento creada con éxito', workout: newWorkout });
});

export const getPlanWorkouts = catchAsync(async (req, res) => {
    const { planId } = req.params;
    if (!req.query.sort) {
        req.query.sort = 'date';
    }

    const query = Workout.find({ plan: planId });
    const features = new ApiFeatures(query, req.query).filter().sort().limitFields().paginate();
    const workouts = await features.query;
    const total = await Workout.countDocuments({ plan: planId });

    res.status(200).json({ total, count: workouts.length, workouts });
});

export const updateWorkout = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { planId, date, name, exercises, isActive } = req.body;

    const updatedWorkout = await Workout.findByIdAndUpdate(
        id,
        { plan: planId, date, name, exercises, isActive },
        { new: true, runValidators: true }
    );

    if (!updatedWorkout) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    res.status(200).json({ message: 'Sesión actualizada con éxito', workout: updatedWorkout });
});

export const deleteWorkout = catchAsync(async (req, res) => {
    const { id } = req.params;
    const workout = await Workout.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!workout) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    res.status(200).json({ message: 'Sesión de entrenamiento eliminada (soft delete)', workout });
});
