import TrainingPlan from '../models/templates/TrainingPlan.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import { sendPushNotification } from '../utils/pushNotifications.js';
import Workout from '../models/templates/Workout.js';

/**
 * Controller para la gestión de Planes de Entrenamiento
 */

// Crear un nuevo plan de entrenamiento (Plantilla)
export const createPlan = catchAsync(async (req, res) => {
    const { name, description, athleteIds, startDate, endDate, coachId: bodyCoachId } = req.body;

    // Si es coach, forzar su propio ID. Si es admin, permitir especificar uno.
    const coachId = req.user.role === 'admin' ? (bodyCoachId || req.user._id) : req.user._id;

    let athletes = [];
    if (athleteIds && athleteIds.length > 0) {
        athletes = await User.find({ _id: { $in: athleteIds } });
        if (athletes.length !== athleteIds.length) {
            return res.status(404).json({ message: 'Uno o más atletas no encontrados' });
        }
    }

    const newPlan = new TrainingPlan({
        name,
        description,
        coach: coachId,
        athletes: athleteIds || [],
        startDate,
        endDate
    });

    await newPlan.save();

    // Crear notificaciones para los atletas asignados que tengan activadas las notificaciones
    if (athleteIds && athleteIds.length > 0) {
        // Obtenemos los usuarios reales que habilitaron notificaciones
        const athletesToNotify = athletes ? athletes.filter(a => a.notificationsEnabled !== false) : [];
        if (athletesToNotify.length > 0) {
            const notifications = athletesToNotify.map(a => ({
                user: a._id,
                type: 'plan_assigned',
                title: 'Nuevo plan asignado',
                message: `El entrenador te ha asignado el plan: ${name}`,
                relatedId: newPlan._id
            }));
            await Notification.insertMany(notifications);

            // Enviar notificaciones Push a los que tengan token
            const pushTokens = athletesToNotify
                .filter(a => a.expoPushToken)
                .map(a => a.expoPushToken);
            
            if (pushTokens.length > 0) {
                await sendPushNotification(
                    pushTokens,
                    'Nuevo plan asignado',
                    `El entrenador te ha asignado el plan: ${name}`,
                    { path: '/notifications' }
                );
            }
        }
    }

    res.status(201).json({ message: 'Plan de entrenamiento creado con éxito', plan: newPlan });
});

// Obtener planes asignados a un atleta (solo activos)
export const getAthletePlans = catchAsync(async (req, res) => {
    // Si no es admin y pide planes de otro atleta, denegar? 
    // Por ahora, usamos el ID de la URL para flexibilidad (un coach viendo a su atleta)
    const { athleteId } = req.params;

    // Crear la query base
    const query = TrainingPlan.find({
        athletes: athleteId,
        isActive: true
    });

    // Aplicar features (sort, pagination, limitfields)
    const features = new ApiFeatures(query, req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const plans = await features.query;
    await TrainingPlan.populate(plans, { path: 'coach', select: 'name email' });

    // Obtener total independiente de la paginación para metadata
    const total = await TrainingPlan.countDocuments({ athletes: athleteId, isActive: true });

    res.status(200).json({
        total,
        count: plans.length,
        plans
    });
});

// Obtener un plan específico por ID
export const getPlanById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const plan = await TrainingPlan.findOne({ _id: id, isActive: true })
        .populate('athletes', 'name email')
        .populate('coach', 'name email');

    if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    res.status(200).json({ plan });
});

// Obtener planes creados por un entrenador (solo activos)
export const getCoachPlans = catchAsync(async (req, res) => {
    const { coachId } = req.params;

    const query = TrainingPlan.find({
        coach: coachId,
        isActive: true
    });

    const features = new ApiFeatures(query, req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const plans = await features.query;
    await TrainingPlan.populate(plans, { path: 'athletes', select: 'name email' });

    const total = await TrainingPlan.countDocuments({ coach: coachId, isActive: true });

    res.status(200).json({
        total,
        count: plans.length,
        plans
    });
});

// Actualizar un plan de entrenamiento
export const updatePlan = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, description, athleteIds, startDate, endDate, coachId: bodyCoachId, isActive } = req.body;

    const plan = await TrainingPlan.findById(id);
    if (!plan || !plan.isActive) {
        return res.status(404).json({ message: 'Plan no encontrado o archivado' });
    }

    // Verificar permiso: solo el coach dueño o un admin pueden actualizar
    if (req.user.role !== 'admin' && plan.coach.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para modificar este plan' });
    }

    if (athleteIds && athleteIds.length > 0) {
        const athletes = await User.find({ _id: { $in: athleteIds } });
        if (athletes.length !== athleteIds.length) {
            return res.status(404).json({ message: 'Uno o más atletas no encontrados' });
        }
    }

    if (name) {
        plan.name = name;
    }
    if (description) {
        plan.description = description;
    }
    if (athleteIds) {
        plan.athletes = athleteIds;
    }
    if (startDate) {
        plan.startDate = startDate;
    }
    if (endDate) {
        plan.endDate = endDate;
    }
    if (isActive !== undefined) {
        plan.isActive = isActive;
    }

    if (req.user.role === 'admin' && bodyCoachId) {
        plan.coach = bodyCoachId;
    }

    await plan.save();

    // Crear notificaciones para los atletas asignados al actualizar
    if (plan.athletes && plan.athletes.length > 0) {
        const athletesToNotify = await User.find({ 
            _id: { $in: plan.athletes }, 
            notificationsEnabled: { $ne: false } 
        });
        
        if (athletesToNotify.length > 0) {
            const notifications = athletesToNotify.map(a => ({
                user: a._id,
                type: 'system',
                title: 'Plan actualizado',
                message: `El plan ${plan.name} ha sido actualizado.`,
                relatedId: plan._id
            }));
            await Notification.insertMany(notifications);

            const pushTokens = athletesToNotify.filter(a => a.expoPushToken).map(a => a.expoPushToken);
            if (pushTokens.length > 0) {
                await sendPushNotification(
                    pushTokens, 
                    'Plan actualizado', 
                    `El plan ${plan.name} ha sido actualizado.`, 
                    { path: '/notifications' }
                );
            }
        }
    }

    res.status(200).json({ message: 'Plan actualizado con éxito', plan });
});

// Archivar un plan de entrenamiento (Soft Delete)
export const deletePlan = catchAsync(async (req, res) => {
    const { id } = req.params;
    const plan = await TrainingPlan.findById(id);

    if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    // Verificar permiso
    if (req.user.role !== 'admin' && plan.coach.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para archivar este plan' });
    }

    plan.isActive = false;
    await plan.save();

    // Crear notificaciones para los atletas asignados al archivar
    if (plan.athletes && plan.athletes.length > 0) {
        const athletesToNotify = await User.find({ 
            _id: { $in: plan.athletes }, 
            notificationsEnabled: { $ne: false } 
        });
        
        if (athletesToNotify.length > 0) {
            const notifications = athletesToNotify.map(a => ({
                user: a._id,
                type: 'system',
                title: 'Plan archivado',
                message: `El plan ${plan.name} ha sido archivado.`,
                relatedId: plan._id
            }));
            await Notification.insertMany(notifications);

            const pushTokens = athletesToNotify.filter(a => a.expoPushToken).map(a => a.expoPushToken);
            if (pushTokens.length > 0) {
                await sendPushNotification(
                    pushTokens, 
                    'Plan archivado', 
                    `El plan ${plan.name} ha sido archivado.`, 
                    { path: '/notifications' }
                );
            }
        }
    }

    res.status(200).json({ message: 'Plan de entrenamiento archivado con éxito', plan });
});

// Obtener todos los planes (para que los atletas exploren)
export const getAllActivePlans = catchAsync(async (req, res) => {
    const plans = await TrainingPlan.find({ isActive: true })
        .populate('coach', 'name email');

    res.status(200).json({
        count: plans.length,
        plans
    });
});

// Inscribir a un atleta en un plan
export const enrollAthlete = catchAsync(async (req, res) => {
    const { id } = req.params;
    // Si el usuario es atleta, puede inscribirse a sí mismo.
    // Si es coach/admin, puede inscribir a cualquier athleteId pasado en el body.
    const athleteId = req.user.role === 'athlete' ? req.user._id : req.body.athleteId;

    if (!athleteId) {
        return res.status(400).json({ message: 'athleteId es requerido' });
    }

    const plan = await TrainingPlan.findOne({ _id: id, isActive: true });
    if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    if (plan.athletes.includes(athleteId)) {
        return res.status(400).json({ message: 'El atleta ya está inscrito en este plan' });
    }

    plan.athletes.push(athleteId);
    await plan.save();

    // Crear notificación para el atleta (si no es él mismo quien se inscribe y tiene notificaciones activas)
    if (req.user._id.toString() !== athleteId.toString()) {
        const athlete = await User.findById(athleteId);
        if (athlete && athlete.notificationsEnabled !== false) {
            await Notification.create({
                user: athleteId,
                type: 'plan_assigned',
                title: 'Inscrito en nuevo plan',
                message: `Has sido inscrito en el plan: ${plan.name}`,
                relatedId: plan._id
            });

            if (athlete.expoPushToken) {
                await sendPushNotification(
                    [athlete.expoPushToken],
                    'Inscrito en nuevo plan',
                    `Has sido inscrito en el plan: ${plan.name}`,
                    { path: '/notifications' }
                );
            }
        }
    }

    res.status(200).json({ message: 'Inscripción exitosa', plan });
});

// Duplicar un plan de entrenamiento
export const duplicatePlan = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;

    const originalPlan = await TrainingPlan.findById(id);
    if (!originalPlan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    // Calcular diferencia de días si se provee startDate
    let daysOffset = 0;
    if (startDate && originalPlan.startDate) {
        const newStart = new Date(startDate);
        const oldStart = new Date(originalPlan.startDate);
        // Calcular offset en milisegundos y pasarlo a días (redondeado)
        daysOffset = Math.round((newStart - oldStart) / (1000 * 60 * 60 * 24));
    }

    const newPlan = new TrainingPlan({
        name: name || `Copia de ${originalPlan.name}`,
        description: originalPlan.description,
        coach: req.user._id,
        athletes: [], // Empieza sin atletas
        startDate: startDate || originalPlan.startDate,
        endDate: endDate || originalPlan.endDate,
        isActive: true
    });

    await newPlan.save();

    // Clonar las sesiones
    const originalWorkouts = await Workout.find({ plan: id, isActive: true });
    
    if (originalWorkouts.length > 0) {
        const newWorkoutsData = originalWorkouts.map(w => {
            const wDate = new Date(w.date);
            if (daysOffset !== 0) {
                wDate.setDate(wDate.getDate() + daysOffset);
            }
            return {
                plan: newPlan._id,
                date: wDate,
                name: w.name,
                estimatedDuration: w.estimatedDuration,
                exercises: w.exercises,
                isActive: true
            };
        });

        await Workout.insertMany(newWorkoutsData);
    }

    res.status(201).json({ message: 'Plan duplicado con éxito', plan: newPlan });
});
