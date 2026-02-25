import Workout from '../models/templates/Workout.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';

/**
 * Controller para la gestión de Sesiones/Workouts (Plantillas)
 */

// Crear una sesión de entrenamiento maestro para un plan
export const createWorkout = async (req, res) => {
    try {
        const { planId, date, name, exercises } = req.body;

        const newWorkout = new Workout({
            plan: planId,
            date,
            name,
            exercises
        });

        await newWorkout.save();
        res.status(201).json({ message: 'Sesión de entrenamiento creada con éxito', workout: newWorkout });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la sesión', error: error.message });
    }
};

// Obtener sesiones de un plan (solo activas)
export const getPlanWorkouts = catchAsync(async (req, res) => {
    const { planId } = req.params;

    // Configurar sort por defecto a date
    if (!req.query.sort) {
        req.query.sort = 'date';
    }

    const query = Workout.find({
        plan: planId,
        isActive: true
    });

    const features = new ApiFeatures(query, req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const workouts = await features.query;
    const total = await Workout.countDocuments({ plan: planId, isActive: true });

    res.status(200).json({
        total,
        count: workouts.length,
        workouts
    });
});

// Actualizar una sesión de entrenamiento
export const updateWorkout = async (req, res) => {
    try {
        const { id } = req.params;
        const { planId, date, name, exercises, isActive } = req.body;

        const updatedWorkout = await Workout.findByIdAndUpdate(
            id,
            {
                plan: planId,
                date,
                name,
                exercises,
                isActive
            },
            { new: true, runValidators: true }
        );

        if (!updatedWorkout) {
            return res.status(404).json({ message: 'Sesión no encontrada' });
        }

        res.status(200).json({ message: 'Sesión actualizada con éxito', workout: updatedWorkout });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la sesión', error: error.message });
    }
};

// Eliminar una sesión (Soft Delete)
export const deleteWorkout = async (req, res) => {
    try {
        const { id } = req.params;
        const workout = await Workout.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!workout) {
            return res.status(404).json({ message: 'Sesión no encontrada' });
        }

        res.status(200).json({ message: 'Sesión de entrenamiento eliminada (soft delete)', workout });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la sesión', error: error.message });
    }
};
