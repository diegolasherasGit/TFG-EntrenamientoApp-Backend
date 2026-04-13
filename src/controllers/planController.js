import TrainingPlan from '../models/templates/TrainingPlan.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';

export const createPlan = catchAsync(async (req, res) => {
    const { name, description, athleteIds, startDate, endDate, coachId } = req.body;

    if (athleteIds && athleteIds.length > 0) {
        const athletes = await User.find({ _id: { $in: athleteIds } });
        if (athletes.length !== athleteIds.length) {
            return res.status(404).json({ message: 'Uno o más atletas no encontrados' });
        }
    }

    const newPlan = new TrainingPlan({
        name, description, coach: coachId, athletes: athleteIds || [], startDate, endDate
    });

    await newPlan.save();
    res.status(201).json({ message: 'Plan de entrenamiento creado con éxito', plan: newPlan });
});

export const getAthletePlans = catchAsync(async (req, res) => {
    const { athleteId } = req.params;

    const query = TrainingPlan.find({ athletes: athleteId }).populate('coach', 'name email');

    const features = new ApiFeatures(query, req.query).filter().sort().limitFields().paginate();
    const plans = await features.query;
    const total = await TrainingPlan.countDocuments({ athletes: athleteId });

    res.status(200).json({ total, count: plans.length, plans });
});

export const getCoachPlans = catchAsync(async (req, res) => {
    const { coachId } = req.params;

    const query = TrainingPlan.find({ coach: coachId }).populate('athletes', 'name email');

    const features = new ApiFeatures(query, req.query).filter().sort().limitFields().paginate();
    const plans = await features.query;
    const total = await TrainingPlan.countDocuments({ coach: coachId });

    res.status(200).json({ total, count: plans.length, plans });
});

export const updatePlan = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, description, athleteIds, startDate, endDate, coachId, isActive } = req.body;

    if (athleteIds && athleteIds.length > 0) {
        const athletes = await User.find({ _id: { $in: athleteIds } });
        if (athletes.length !== athleteIds.length) {
            return res.status(404).json({ message: 'Uno o más atletas no encontrados' });
        }
    }

    const updatedPlan = await TrainingPlan.findByIdAndUpdate(
        // Use the object ID instead of findOneAndUpdate query since we don't need manual isActive filter anymore
        id,
        { name, description, coach: coachId, athletes: athleteIds, startDate, endDate, isActive },
        { new: true, runValidators: true }
    );

    if (!updatedPlan) {
        return res.status(404).json({ message: 'Plan no encontrado o archivado' });
    }

    res.status(200).json({ message: 'Plan actualizado con éxito', plan: updatedPlan });
});

export const deletePlan = catchAsync(async (req, res) => {
    const { id } = req.params;
    const plan = await TrainingPlan.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    res.status(200).json({ message: 'Plan de entrenamiento archivado con éxito', plan });
});
