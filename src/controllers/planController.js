import TrainingPlan from '../models/templates/TrainingPlan.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';

/**
 * Controller para la gestión de Planes de Entrenamiento
 */

// Crear un nuevo plan de entrenamiento (Plantilla)
export const createPlan = catchAsync(async (req, res) => {
    const { name, description, athleteIds, startDate, endDate, coachId: bodyCoachId } = req.body;

    // Si es coach, forzar su propio ID. Si es admin, permitir especificar uno.
    const coachId = req.user.role === 'admin' ? (bodyCoachId || req.user._id) : req.user._id;

    if (athleteIds && athleteIds.length > 0) {
        const athletes = await User.find({ _id: { $in: athleteIds } });
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
    }).populate('coach', 'name email');

    // Aplicar features (sort, pagination, limitfields)
    const features = new ApiFeatures(query, req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const plans = await features.query;

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
    }).populate('athletes', 'name email');

    const features = new ApiFeatures(query, req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const plans = await features.query;

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

    res.status(200).json({ message: 'Inscripción exitosa', plan });
});
