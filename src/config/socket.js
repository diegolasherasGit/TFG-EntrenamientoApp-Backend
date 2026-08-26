import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './logger.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import Message from '../models/Message.js';
import { canAccessPlan } from '../utils/planAccess.js';
import { notifyAthletes } from '../utils/notifyAthletes.js';
import { getCorsOrigins } from './cors.js';

let io;

export const initializeSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: getCorsOrigins(),
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Middleware de autenticación
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        if (!token) {
            return next(new Error('Authentication error: Token not provided'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; // Guardar el ID de usuario en el socket
            next();
        } catch {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        logger.info(`Nuevo cliente conectado vía socket: ${socket.id} (User: ${socket.user.id})`);

        socket.on('join_plan_room', async (planId, callback) => {
            try {
                // Verificar que el plan exista
                const plan = await TrainingPlan.findById(planId);
                if (!plan) {
                    if (callback) {callback({ error: 'Plan no encontrado' });}
                    return;
                }

                // Verificar acceso (solo coach dueño o atleta inscrito)
                if (!canAccessPlan(plan, socket.user.id)) {
                    if (callback) {callback({ error: 'No tienes acceso a este plan' });}
                    return;
                }

                const roomName = `plan_${planId}`;
                socket.join(roomName);
                logger.info(`User ${socket.user.id} se unió a la sala ${roomName}`);
                
                if (callback) {callback({ success: true, room: roomName });}
            } catch (error) {
                logger.error(`Error al unirse a la sala: ${error.message}`);
                if (callback) {callback({ error: 'Error interno del servidor' });}
            }
        });

        socket.on('send_message', async (data, callback) => {
            try {
                const { planId, text } = data;
                
                if (!text || !text.trim()) {
                    if (callback) {callback({ error: 'El mensaje no puede estar vacío' });}
                    return;
                }

                // Validar acceso nuevamente
                const plan = await TrainingPlan.findById(planId);
                if (!plan) {
                    if (callback) {callback({ error: 'Plan no encontrado' });}
                    return;
                }

                if (!canAccessPlan(plan, socket.user.id)) {
                    if (callback) {callback({ error: 'No tienes acceso para enviar en este plan' });}
                    return;
                }

                // Guardar en DB
                const newMessage = await Message.create({
                    planId,
                    sender: socket.user.id,
                    text
                });

                // Poblar sender info
                await newMessage.populate('sender', 'name email');

                // Emitir a todos en la sala (incluyendo al sender, para confirmar)
                const roomName = `plan_${planId}`;
                io.to(roomName).emit('new_message', newMessage);

                // Notificar (in-app + push) a todo el resto de participantes del chat
                // del plan: el coach y todos los atletas apuntados, menos quien acaba
                // de escribir. Best-effort: un fallo aquí no debe tumbar el mensaje.
                try {
                    const recipientIds = [plan.coach, ...plan.athletes]
                        .filter((id) => id.toString() !== socket.user.id.toString());

                    await notifyAthletes(recipientIds, {
                        type: 'new_message',
                        title: `Nuevo mensaje en ${plan.name}`.slice(0, 100),
                        message: `${newMessage.sender.name}: ${text}`.slice(0, 500),
                        relatedId: planId,
                    });
                } catch (notifErr) {
                    logger.error(`No se pudo notificar el nuevo mensaje de chat (socket): ${notifErr.message}`);
                }

                if (callback) {callback({ success: true, message: newMessage });}
            } catch (error) {
                logger.error(`Error enviando mensaje por socket: ${error.message}`);
                if (callback) {callback({ error: 'Error interno al enviar mensaje' });}
            }
        });

        socket.on('disconnect', () => {
            logger.info(`Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io no está inicializado');
    }
    return io;
};
