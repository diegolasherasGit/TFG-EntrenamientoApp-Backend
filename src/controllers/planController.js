import TrainingPlan from '../models/templates/TrainingPlan.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import { notifyAthletes } from '../utils/notifyAthletes.js';
import Workout from '../models/templates/Workout.js';
import { isWorkoutDateWithinPlan, isValidPlanRange, planRangeOrderMessage } from '../utils/planDateRange.js';
import { ROLES } from '../constants/roles.js';

/**
 * Controller para la gestión de Planes de Entrenamiento
 */

// Crear un nuevo plan de entrenamiento (Plantilla)
export const createPlan = catchAsync(async (req, res, next) => {
    const { name, description, athleteIds, startDate, endDate, coachId: bodyCoachId } = req.body;

    // El plan debe abarcar al menos un día (inicio != fin)
    if (!isValidPlanRange(startDate, endDate)) {
        return next(new AppError(planRangeOrderMessage, 400));
    }

    // Si es coach, forzar su propio ID. Si es admin, permitir especificar uno.
    const coachId = req.user.role === ROLES.ADMIN ? (bodyCoachId || req.user._id) : req.user._id;

    if (athleteIds && athleteIds.length > 0) {
        const athletes = await User.find({ _id: { $in: athleteIds } });
        if (athletes.length !== athleteIds.length) {
            return next(new AppError('Uno o más atletas no encontrados', 404));
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

    // Notificar a los atletas asignados
    await notifyAthletes(athleteIds, {
        type: 'plan_assigned',
        title: 'Nuevo plan asignado',
        message: `El entrenador te ha asignado el plan: ${name}`,
        relatedId: newPlan._id
    });

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
export const getPlanById = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const plan = await TrainingPlan.findOne({ _id: id, isActive: true })
        .populate('athletes', 'name email')
        .populate('coach', 'name email');

    if (!plan) {
        return next(new AppError('Plan no encontrado', 404));
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
export const updatePlan = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, description, athleteIds, startDate, endDate, coachId: bodyCoachId, isActive } = req.body;

    const plan = await TrainingPlan.findById(id);
    if (!plan || !plan.isActive) {
        return next(new AppError('Plan no encontrado o archivado', 404));
    }

    // Verificar permiso: solo el coach dueño o un admin pueden actualizar
    if (req.user.role !== ROLES.ADMIN && plan.coach.toString() !== req.user._id.toString()) {
        return next(new AppError('No tienes permiso para modificar este plan', 403));
    }

    if (athleteIds && athleteIds.length > 0) {
        const athletes = await User.find({ _id: { $in: athleteIds } });
        if (athletes.length !== athleteIds.length) {
            return next(new AppError('Uno o más atletas no encontrados', 404));
        }
    }

    // Si se cambian las fechas, validar coherencia y que ninguna sesión activa
    // del plan quede fuera del nuevo rango.
    if (startDate || endDate) {
        const effectiveRange = {
            startDate: startDate || plan.startDate,
            endDate: endDate || plan.endDate
        };
        if (!isValidPlanRange(effectiveRange.startDate, effectiveRange.endDate)) {
            return next(new AppError(planRangeOrderMessage, 400));
        }
        const planWorkouts = await Workout.find({ plan: plan._id, isActive: true }).select('date');
        const outsideCount = planWorkouts.filter(w => !isWorkoutDateWithinPlan(w.date, effectiveRange)).length;
        if (outsideCount > 0) {
            const fmt = (d) => new Date(d).toISOString().slice(0, 10);
            return next(new AppError(
                `No se puede aplicar ese rango: ${outsideCount} sesión(es) quedarían fuera del plan (${fmt(effectiveRange.startDate)} a ${fmt(effectiveRange.endDate)}). Mueve o elimina esas sesiones antes de cambiar las fechas.`,
                400
            ));
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

    if (req.user.role === ROLES.ADMIN && bodyCoachId) {
        plan.coach = bodyCoachId;
    }

    await plan.save();

    // Notificar a los atletas asignados de la actualización
    await notifyAthletes(plan.athletes, {
        type: 'system',
        title: 'Plan actualizado',
        message: `El plan ${plan.name} ha sido actualizado.`,
        relatedId: plan._id
    });

    res.status(200).json({ message: 'Plan actualizado con éxito', plan });
});

// Archivar un plan de entrenamiento (Soft Delete)
export const deletePlan = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const plan = await TrainingPlan.findById(id);

    if (!plan) {
        return next(new AppError('Plan no encontrado', 404));
    }

    // Verificar permiso
    if (req.user.role !== ROLES.ADMIN && plan.coach.toString() !== req.user._id.toString()) {
        return next(new AppError('No tienes permiso para archivar este plan', 403));
    }

    plan.isActive = false;
    await plan.save();

    // Notificar a los atletas asignados del archivado
    await notifyAthletes(plan.athletes, {
        type: 'system',
        title: 'Plan archivado',
        message: `El plan ${plan.name} ha sido archivado.`,
        relatedId: plan._id
    });

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
export const enrollAthlete = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    // Si el usuario es atleta, puede inscribirse a sí mismo.
    // Si es coach/admin, puede inscribir a cualquier athleteId pasado en el body.
    const athleteId = req.user.role === ROLES.ATHLETE ? req.user._id : req.body.athleteId;

    if (!athleteId) {
        return next(new AppError('athleteId es requerido', 400));
    }

    const plan = await TrainingPlan.findOne({ _id: id, isActive: true });
    if (!plan) {
        return next(new AppError('Plan no encontrado', 404));
    }

    if (plan.athletes.includes(athleteId)) {
        return next(new AppError('El atleta ya está inscrito en este plan', 400));
    }

    plan.athletes.push(athleteId);
    await plan.save();

    // Notificar al atleta inscrito, salvo que se haya inscrito él mismo
    if (req.user._id.toString() !== athleteId.toString()) {
        await notifyAthletes([athleteId], {
            type: 'plan_assigned',
            title: 'Inscrito en nuevo plan',
            message: `Has sido inscrito en el plan: ${plan.name}`,
            relatedId: plan._id
        });
    }

    res.status(200).json({ message: 'Inscripción exitosa', plan });
});

// Duplicar un plan de entrenamiento
export const duplicatePlan = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;

    const originalPlan = await TrainingPlan.findById(id);
    if (!originalPlan) {
        return next(new AppError('Plan no encontrado', 404));
    }

    // El rango efectivo de la copia debe abarcar al menos un día (inicio != fin)
    if (!isValidPlanRange(startDate || originalPlan.startDate, endDate || originalPlan.endDate)) {
        return next(new AppError(planRangeOrderMessage, 400));
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
