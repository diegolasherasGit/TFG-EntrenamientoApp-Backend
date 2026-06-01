import Message from '../models/Message.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import catchAsync from '../utils/catchAsync.js';

export const getPlanMessages = catchAsync(async (req, res) => {
    const { planId } = req.params;
    
    // Check if plan exists and user has access
    const plan = await TrainingPlan.findById(planId);
    if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    const isCoach = plan.coach.toString() === req.user._id.toString();
    const isAthlete = plan.athletes.includes(req.user._id);
    if (req.user.role !== 'admin' && !isCoach && !isAthlete) {
        return res.status(403).json({ message: 'No tienes permiso para ver este chat' });
    }

    const messages = await Message.find({ planId })
        .populate('sender', 'name email')
        .sort({ createdAt: 1 }); // Oldest first or newest first depending on frontend, usually newest first for flatlist inverted. Let's send newest first.
        
    res.status(200).json({
        messages: messages.reverse() // Send newest first if frontend expects it for inverted list, or we can do sort({ createdAt: -1 }).
    });
});

export const createMessage = catchAsync(async (req, res) => {
    const { planId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ message: 'El texto del mensaje no puede estar vacío' });
    }

    const plan = await TrainingPlan.findById(planId);
    if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
    }

    const isCoach = plan.coach.toString() === req.user._id.toString();
    const isAthlete = plan.athletes.includes(req.user._id);
    if (req.user.role !== 'admin' && !isCoach && !isAthlete) {
        return res.status(403).json({ message: 'No tienes permiso para enviar mensajes en este chat' });
    }

    const newMessage = await Message.create({
        planId,
        sender: req.user._id,
        text
    });

    await newMessage.populate('sender', 'name email');

    res.status(201).json({ message: newMessage });
});
