import Workout from '../models/templates/Workout.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import { notifyAthletes } from '../utils/notifyAthletes.js';
import { isWorkoutDateWithinPlan, planDateRangeMessage } from '../utils/planDateRange.js';
import { ROLES } from '../constants/roles.js';

/**
 * Controller para la gestión de Sesiones/Workouts (Plantillas)
 */

// El cliente puede reenviar ejercicios con techniqueVideo poblado ({ _id, ... });
// en BD siempre se guarda el ObjectId (o null si no tiene vídeo asociado)
const normalizeExercises = (exercises) => exercises?.map(ex => ({
    ...ex,
    techniqueVideo: ex.techniqueVideo?._id || ex.techniqueVideo || null,
    exercisePhoto: ex.exercisePhoto?._id || ex.exercisePhoto || null
}));

// Crear una sesión de entrenamiento maestro para un plan
export const createWorkout = catchAsync(async (req, res, next) => {
    const { planId, date, time, name, estimatedDuration, exercises } = req.body;

    const plan = await TrainingPlan.findById(planId);
    if (!plan) {
        return next(new AppError('Plan no encontrado', 404));
    }

    // Verificar permiso: solo el coach del plan o admin
    if (req.user.role !== ROLES.ADMIN && plan.coach.toString() !== req.user._id.toString()) {
        return next(new AppError('No tienes permiso para añadir sesiones a este plan', 403));
    }

    // La fecha de la sesión debe caer dentro del rango del plan
    if (!isWorkoutDateWithinPlan(date, plan)) {
        return next(new AppError(planDateRangeMessage(plan), 400));
    }

    const newWorkout = new Workout({
        plan: planId,
        date,
        time,
        name,
        estimatedDuration,
        exercises: normalizeExercises(exercises)
    });

    await newWorkout.save();

    // Notificar a los atletas del plan
    await notifyAthletes(plan.athletes, {
        type: 'workout_updated',
        title: 'Nueva sesión añadida',
        message: `Se ha añadido la sesión ${newWorkout.name} al plan ${plan.name}.`,
        relatedId: plan._id
    });

    res.status(201).json({ message: 'Sesión de entrenamiento creada con éxito', workout: newWorkout });
});

// Obtener una sesión específica por ID
export const getWorkoutById = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const workout = await Workout.findById(id)
        .populate('plan')
        // El detalle incluye el vídeo de técnica y la foto de cada ejercicio
        // para que el atleta pueda verlos durante el entrenamiento
        .populate('exercises.techniqueVideo', 'title videoUrl')
        .populate('exercises.exercisePhoto', 'title imageUrl')
        // Atletas apuntados a la sesión (para que el coach vea la asistencia)
        .populate('attendees', 'name photo');

    if (!workout) {
        return next(new AppError('Sesión no encontrada', 404));
    }

    res.status(200).json(workout);
});

// Apuntar al atleta autenticado a una sesión (asistencia previa)
export const attendWorkout = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const athleteId = req.user._id;

    const workout = await Workout.findOne({ _id: id, isActive: true });
    if (!workout) {
        return next(new AppError('Sesión no encontrada', 404));
    }

    // Solo los atletas inscritos en el plan de la sesión pueden apuntarse
    const plan = await TrainingPlan.findById(workout.plan);
    if (!plan || !plan.athletes.some(a => a.toString() === athleteId.toString())) {
        return next(new AppError('No estás inscrito en el plan de esta sesión', 403));
    }

    if (workout.attendees.some(a => a.toString() === athleteId.toString())) {
        return next(new AppError('Ya estás apuntado a esta sesión', 400));
    }

    workout.attendees.push(athleteId);
    await workout.save();

    // Avisar al coach del plan de que un atleta se ha apuntado
    await notifyAthletes([plan.coach], {
        type: 'system',
        title: 'Nuevo atleta apuntado',
        message: `${req.user.name} se ha apuntado a la sesión: ${workout.name}`,
        relatedId: plan._id
    });

    res.status(200).json({ message: 'Te has apuntado a la sesión', attendees: workout.attendees });
});

// Desapuntar al atleta autenticado de una sesión
export const unattendWorkout = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const athleteId = req.user._id;

    const workout = await Workout.findOne({ _id: id, isActive: true });
    if (!workout) {
        return next(new AppError('Sesión no encontrada', 404));
    }

    const before = workout.attendees.length;
    workout.attendees = workout.attendees.filter(a => a.toString() !== athleteId.toString());

    if (workout.attendees.length === before) {
        return next(new AppError('No estabas apuntado a esta sesión', 400));
    }

    await workout.save();

    res.status(200).json({ message: 'Te has desapuntado de la sesión', attendees: workout.attendees });
});

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

// Obtener todos los ejercicios estructurados para poblar el calendario del usuario
export const getMyCalendarWorkouts = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const role = req.user.role;

    let planIds;

    // Según el rol, busca los planes en los que esta involucrado el usuario
    if (role === ROLES.COACH || role === ROLES.ADMIN) {
        const query = role === ROLES.ADMIN ? { isActive: true } : { coach: userId, isActive: true };
        const plans = await TrainingPlan.find(query).select('_id');
        planIds = plans.map(p => p._id);
    } else {
        const plans = await TrainingPlan.find({ athletes: userId, isActive: true }).select('_id');
        planIds = plans.map(p => p._id);
    }

    const workouts = await Workout.find({
        plan: { $in: planIds },
        isActive: true
    }).populate('plan', 'name').sort('date');

    res.status(200).json(workouts);
});

// Actualizar una sesión de entrenamiento
export const updateWorkout = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { date, time, name, estimatedDuration, exercises, isActive } = req.body;

    const workout = await Workout.findById(id).populate('plan');
    if (!workout) {
        return next(new AppError('Sesión no encontrada', 404));
    }

    // Verificar permiso
    if (req.user.role !== ROLES.ADMIN && workout.plan.coach.toString() !== req.user._id.toString()) {
        return next(new AppError('No tienes permiso para modificar esta sesión', 403));
    }

    // Si se cambia la fecha, debe seguir dentro del rango del plan
    if (date && !isWorkoutDateWithinPlan(date, workout.plan)) {
        return next(new AppError(planDateRangeMessage(workout.plan), 400));
    }

    if (date) {workout.date = date;}
    if (time !== undefined) {workout.time = time;}
    if (name !== undefined) {workout.name = name;}
    if (estimatedDuration !== undefined) {workout.estimatedDuration = estimatedDuration;}
    if (exercises) {workout.exercises = normalizeExercises(exercises);}
    if (isActive !== undefined) {workout.isActive = isActive;}

    await workout.save();

    // Notificar a los atletas de la actualización
    await notifyAthletes(workout.plan.athletes, {
        type: 'workout_updated',
        title: 'Sesión actualizada',
        message: `La sesión ${workout.name} del plan ${workout.plan.name} ha sido actualizada.`,
        relatedId: workout.plan._id
    });

    res.status(200).json({ message: 'Sesión actualizada con éxito', workout });
});

// Eliminar una sesión (Soft Delete)
export const deleteWorkout = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const workout = await Workout.findById(id).populate('plan');

    if (!workout) {
        return next(new AppError('Sesión no encontrada', 404));
    }

    // Verificar permiso
    if (req.user.role !== ROLES.ADMIN && workout.plan.coach.toString() !== req.user._id.toString()) {
        return next(new AppError('No tienes permiso para eliminar esta sesión', 403));
    }

    workout.isActive = false;
    await workout.save();

    // Notificar a los atletas de la eliminación
    await notifyAthletes(workout.plan.athletes, {
        type: 'workout_updated',
        title: 'Sesión eliminada',
        message: `La sesión ${workout.name} ha sido eliminada del plan ${workout.plan.name}.`,
        relatedId: workout.plan._id
    });

    res.status(200).json({ message: 'Sesión de entrenamiento eliminada (soft delete)', workout });
});

// Duplicar una sesión
export const duplicateWorkout = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { date, time, planId } = req.body;

    const originalWorkout = await Workout.findById(id).populate('plan');
    if (!originalWorkout) {
        return next(new AppError('Sesión no encontrada', 404));
    }

    // Verificar permiso: solo admin o el coach del plan
    if (req.user.role !== ROLES.ADMIN && originalWorkout.plan.coach.toString() !== req.user._id.toString()) {
        return next(new AppError('No tienes permiso para duplicar esta sesión', 403));
    }

    // Si se pasa un planId diferente, validar que exista y que el user sea coach de ese plan
    let targetPlan = originalWorkout.plan;
    let targetPlanId = originalWorkout.plan._id;
    if (planId && planId !== originalWorkout.plan._id.toString()) {
        const otherPlan = await TrainingPlan.findById(planId);
        if (!otherPlan) {
            return next(new AppError('Plan destino no encontrado', 404));
        }
        if (req.user.role !== ROLES.ADMIN && otherPlan.coach.toString() !== req.user._id.toString()) {
            return next(new AppError('No tienes permiso para añadir sesiones al plan destino', 403));
        }
        targetPlan = otherPlan;
        targetPlanId = planId;
    }

    // La fecha de la copia debe caer dentro del rango del plan destino
    const duplicatedDate = date || originalWorkout.date;
    if (!isWorkoutDateWithinPlan(duplicatedDate, targetPlan)) {
        return next(new AppError(planDateRangeMessage(targetPlan), 400));
    }

    const newWorkout = new Workout({
        plan: targetPlanId,
        date: duplicatedDate,
        time: time || originalWorkout.time,
        name: `${originalWorkout.name} (Copia)`,
        estimatedDuration: originalWorkout.estimatedDuration,
        exercises: originalWorkout.exercises,
        isActive: true
    });

    await newWorkout.save();

    res.status(201).json({ message: 'Sesión duplicada con éxito', workout: newWorkout });
});
