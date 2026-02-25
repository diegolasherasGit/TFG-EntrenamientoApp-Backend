import TrainingPlan from '../models/templates/TrainingPlan.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';

/**
 * Controller para la gestión de Planes de Entrenamiento
 */

// Crear un nuevo plan de entrenamiento (Plantilla)
export const createPlan = async (req, res) => {
    try {
        const { name, description, athleteIds, startDate, endDate, coachId } = req.body;

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
    } catch (error) {
        res.status(500).json({ message: 'Error al crear el plan', error: error.message });
    }
};

// Obtener planes asignados a un atleta (solo activos)
export const getAthletePlans = catchAsync(async (req, res) => {
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
export const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, athleteIds, startDate, endDate, coachId, isActive } = req.body;

        if (athleteIds && athleteIds.length > 0) {
            const athletes = await User.find({ _id: { $in: athleteIds } });
            if (athletes.length !== athleteIds.length) {
                return res.status(404).json({ message: 'Uno o más atletas no encontrados' });
            }
        }

        const updatedPlan = await TrainingPlan.findOneAndUpdate(
            { _id: id, isActive: true },
            {
                name,
                description,
                coach: coachId,
                athletes: athleteIds,
                startDate,
                endDate,
                isActive
            },
            { new: true, runValidators: true }
        );

        if (!updatedPlan) {
            return res.status(404).json({ message: 'Plan no encontrado o archivado' });
        }

        res.status(200).json({ message: 'Plan actualizado con éxito', plan: updatedPlan });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el plan', error: error.message });
    }
};

// Archivar un plan de entrenamiento (Soft Delete)
export const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await TrainingPlan.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!plan) {
            return res.status(404).json({ message: 'Plan no encontrado' });
        }

        res.status(200).json({ message: 'Plan de entrenamiento archivado con éxito', plan });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el plan', error: error.message });
    }
};
