import Workout from '../models/templates/Workout.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendPushNotification } from '../utils/pushNotifications.js';

/**
 * Controller para la gestión de Sesiones/Workouts (Plantillas)
 */

// Crear una sesión de entrenamiento maestro para un plan
export const createWorkout = catchAsync(async (req, res) => {
    const { planId, date, name, estimatedDuration, exercises } = req.body;

    const plan = await TrainingPlan.findById(planId);
    if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    // Verificar permiso: solo el coach del plan o admin
    if (req.user.role !== 'admin' && plan.coach.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para añadir sesiones a este plan' });
    }

    const newWorkout = new Workout({
        plan: planId,
        date,
        name,
        estimatedDuration,
        exercises
    });

    await newWorkout.save();

    // Notificar a los atletas del plan
    if (plan.athletes && plan.athletes.length > 0) {
        const athletesToNotify = await User.find({ 
            _id: { $in: plan.athletes }, 
            notificationsEnabled: { $ne: false } 
        });
        
        if (athletesToNotify.length > 0) {
            const notifications = athletesToNotify.map(a => ({
                user: a._id,
                type: 'workout_updated',
                title: 'Nueva sesión añadida',
                message: `Se ha añadido la sesión ${newWorkout.name} al plan ${plan.name}.`,
                relatedId: plan._id
            }));
            await Notification.insertMany(notifications);

            const pushTokens = athletesToNotify.filter(a => a.expoPushToken).map(a => a.expoPushToken);
            if (pushTokens.length > 0) {
                await sendPushNotification(
                    pushTokens, 
                    'Nueva sesión añadida', 
                    `Se ha añadido la sesión ${newWorkout.name} al plan ${plan.name}.`, 
                    { path: '/notifications' }
                );
            }
        }
    }

    res.status(201).json({ message: 'Sesión de entrenamiento creada con éxito', workout: newWorkout });
});

// Obtener una sesión específica por ID
export const getWorkoutById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const workout = await Workout.findById(id).populate('plan');

    if (!workout) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    res.status(200).json(workout);
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
    // Usamos los datos del usuario autenticado (JWT)
    const userId = req.user._id;
    const role = req.user.role;

    let planIds = [];

    // Según el rol, busca los planes en los que esta involucrado el usuario
    if (role === 'coach' || role === 'admin') {
        const query = role === 'admin' ? { isActive: true } : { coach: userId, isActive: true };
        const plans = await TrainingPlan.find(query).select('_id');
        planIds = plans.map(p => p._id);
    } else {
        const plans = await TrainingPlan.find({ athletes: userId, isActive: true }).select('_id');
        planIds = plans.map(p => p._id);
    }

    // Traer todos los workouts de la BD de esos planes, incluyendo el nombre del plan maestro
    const workouts = await Workout.find({
        plan: { $in: planIds },
        isActive: true
    }).populate('plan', 'name').sort('date');

    res.status(200).json(workouts);
});

// Actualizar una sesión de entrenamiento
export const updateWorkout = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { date, name, estimatedDuration, exercises, isActive } = req.body;

    const workout = await Workout.findById(id).populate('plan');
    if (!workout) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    // Verificar permiso
    if (req.user.role !== 'admin' && workout.plan.coach.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para modificar esta sesión' });
    }

    if (date) {
        workout.date = date;
    }
    if (name !== undefined) {
        workout.name = name;
    }
    if (estimatedDuration !== undefined) {
        workout.estimatedDuration = estimatedDuration;
    }
    if (exercises) {
        workout.exercises = exercises;
    }
    if (isActive !== undefined) {
        workout.isActive = isActive;
    }

    await workout.save();

    // Notificar a los atletas
    if (workout.plan.athletes && workout.plan.athletes.length > 0) {
        const athletesToNotify = await User.find({ 
            _id: { $in: workout.plan.athletes }, 
            notificationsEnabled: { $ne: false } 
        });
        
        if (athletesToNotify.length > 0) {
            const notifications = athletesToNotify.map(a => ({
                user: a._id,
                type: 'workout_updated',
                title: 'Sesión actualizada',
                message: `La sesión ${workout.name} del plan ${workout.plan.name} ha sido actualizada.`,
                relatedId: workout.plan._id
            }));
            await Notification.insertMany(notifications);

            const pushTokens = athletesToNotify.filter(a => a.expoPushToken).map(a => a.expoPushToken);
            if (pushTokens.length > 0) {
                await sendPushNotification(
                    pushTokens, 
                    'Sesión actualizada', 
                    `La sesión ${workout.name} del plan ${workout.plan.name} ha sido actualizada.`, 
                    { path: '/notifications' }
                );
            }
        }
    }

    res.status(200).json({ message: 'Sesión actualizada con éxito', workout });
});

// Eliminar una sesión (Soft Delete)
export const deleteWorkout = catchAsync(async (req, res) => {
    const { id } = req.params;
    const workout = await Workout.findById(id).populate('plan');

    if (!workout) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    // Verificar permiso
    if (req.user.role !== 'admin' && workout.plan.coach.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para eliminar esta sesión' });
    }

    workout.isActive = false;
    await workout.save();

    // Notificar a los atletas
    if (workout.plan.athletes && workout.plan.athletes.length > 0) {
        const athletesToNotify = await User.find({ 
            _id: { $in: workout.plan.athletes }, 
            notificationsEnabled: { $ne: false } 
        });
        
        if (athletesToNotify.length > 0) {
            const notifications = athletesToNotify.map(a => ({
                user: a._id,
                type: 'workout_updated',
                title: 'Sesión eliminada',
                message: `La sesión ${workout.name} ha sido eliminada del plan ${workout.plan.name}.`,
                relatedId: workout.plan._id
            }));
            await Notification.insertMany(notifications);

            const pushTokens = athletesToNotify.filter(a => a.expoPushToken).map(a => a.expoPushToken);
            if (pushTokens.length > 0) {
                await sendPushNotification(
                    pushTokens, 
                    'Sesión eliminada', 
                    `La sesión ${workout.name} ha sido eliminada del plan ${workout.plan.name}.`, 
                    { path: '/notifications' }
                );
            }
        }
    }

    res.status(200).json({ message: 'Sesión de entrenamiento eliminada (soft delete)', workout });
});

// Duplicar una sesión
export const duplicateWorkout = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { date, planId } = req.body;

    const originalWorkout = await Workout.findById(id).populate('plan');
    if (!originalWorkout) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    // Verificar permiso: solo admin o el coach del plan
    if (req.user.role !== 'admin' && originalWorkout.plan.coach.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para duplicar esta sesión' });
    }

    // Si se pasa un planId diferente, hay que validar que exista y que el user sea admin o coach de ese plan
    let targetPlanId = originalWorkout.plan._id;
    if (planId && planId !== originalWorkout.plan._id.toString()) {
        const targetPlan = await TrainingPlan.findById(planId);
        if (!targetPlan) {
            return res.status(404).json({ message: 'Plan destino no encontrado' });
        }
        if (req.user.role !== 'admin' && targetPlan.coach.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'No tienes permiso para añadir sesiones al plan destino' });
        }
        targetPlanId = planId;
    }

    const newWorkout = new Workout({
        plan: targetPlanId,
        date: date || originalWorkout.date,
        name: `${originalWorkout.name} (Copia)`,
        estimatedDuration: originalWorkout.estimatedDuration,
        exercises: originalWorkout.exercises,
        isActive: true
    });

    await newWorkout.save();

    res.status(201).json({ message: 'Sesión duplicada con éxito', workout: newWorkout });
});
