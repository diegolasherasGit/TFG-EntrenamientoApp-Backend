import Message from '../models/Message.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import { canAccessPlan } from '../utils/planAccess.js';
import { getIO } from '../config/socket.js';

export const getPlanMessages = catchAsync(async (req, res, next) => {
    const { planId } = req.params;

    const plan = await TrainingPlan.findById(planId);
    if (!plan) {
        return next(new AppError('Plan no encontrado', 404));
    }

    if (!canAccessPlan(plan, req.user._id)) {
        return next(new AppError('No tienes permiso para ver este chat', 403));
    }

    const messages = await Message.find({ planId })
        .populate('sender', 'name email')
        .sort({ createdAt: 1 });

    res.status(200).json({
        messages: messages.reverse()
    });
});

export const createMessage = catchAsync(async (req, res, next) => {
    const { planId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
        return next(new AppError('El texto del mensaje no puede estar vacío', 400));
    }

    const plan = await TrainingPlan.findById(planId);
    if (!plan) {
        return next(new AppError('Plan no encontrado', 404));
    }

    if (!canAccessPlan(plan, req.user._id)) {
        return next(new AppError('No tienes permiso para enviar mensajes en este chat', 403));
    }

    const newMessage = await Message.create({
        planId,
        sender: req.user._id,
        text
    });

    await newMessage.populate('sender', 'name email');

    // Emitir a todos los clientes conectados en la sala para que les llegue en tiempo real
    try {
        getIO().to(`plan_${planId}`).emit('new_message', newMessage);
    } catch {
        // Si el socket no está inicializado (p. ej. en tests), no bloqueamos la respuesta HTTP
    }

    res.status(201).json({ message: newMessage });
});

export const deleteMessage = catchAsync(async (req, res, next) => {
    const { planId, messageId } = req.params;

    const message = await Message.findOne({ _id: messageId, planId });
    if (!message) {
        return next(new AppError('Mensaje no encontrado', 404));
    }

    // Solo quien lo escribió puede borrarlo (ni el otro participante ni un admin:
    // los admins no acceden al chat de los planes, ver canAccessPlan).
    if (message.sender.toString() !== req.user._id.toString()) {
        return next(new AppError('No tienes permiso para borrar este mensaje', 403));
    }

    message.isActive = false;
    await message.save();

    // Avisar en tiempo real a quien tenga el chat abierto para que lo quite de su lista
    try {
        getIO().to(`plan_${planId}`).emit('message_deleted', { messageId });
    } catch {
        // Si el socket no está inicializado (p. ej. en tests), no bloqueamos la respuesta HTTP
    }

    res.status(200).json({ message: 'Mensaje eliminado' });
});
