import request from 'supertest';
import { createServer } from 'http';
import mongoose from 'mongoose';
import Client from 'socket.io-client';
import app from '../../app.js';
import { initializeSocket } from '../../config/socket.js';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import Notification from '../../models/Notification.js';

describe('Socket.io Chat', () => {
    let io, clientSocket;
    let coachToken, coachId, athleteId, planId, adminToken;
    let httpServer;
    const port = 3005;

    beforeAll(async () => {
        // Setup base test env
        const env = await setupTestEnv('test_socket_chat');
        ({ coachToken, coachId, athleteId, adminToken } = env);

        // Crear plan
        const resPlan = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan Socket Chat', startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        planId = resPlan.body.plan._id;

        await request(app).post(`/api/training/plans/${planId}/enroll`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ athleteId });

        // Setup server and socket
        httpServer = createServer(app);
        io = initializeSocket(httpServer);
        
        await new Promise((resolve) => {
            httpServer.listen(port, () => {
                resolve();
            });
        });
    }, 60000);

    afterAll(async () => {
        if (clientSocket) {
            clientSocket.close();
        }
        await new Promise((resolve) => {
            io.close(() => {
                httpServer.close(resolve);
            });
        });
        await teardownTestEnv();
    });

    it('debería autenticar la conexión de socket y unirse a la sala', (done) => {
        clientSocket = Client(`http://localhost:${port}`, {
            auth: { token: coachToken }
        });

        clientSocket.on('connect', () => {
            clientSocket.emit('join_plan_room', planId, (response) => {
                expect(response.success).toBe(true);
                expect(response.room).toBe(`plan_${planId}`);
                done();
            });
        });
    });

    it('debería enviar un mensaje y recibirlo en la sala', (done) => {
        // Escuchar por mensajes nuevos (once: si no, el listener queda enganchado
        // y se dispara también con mensajes de tests posteriores)
        clientSocket.once('new_message', (msg) => {
            expect(msg.text).toBe('Hola vía Socket');
            expect(msg.planId.toString()).toBe(planId.toString());
            done();
        });

        // Emitir el mensaje
        clientSocket.emit('send_message', { planId, text: 'Hola vía Socket' }, (response) => {
            expect(response.success).toBe(true);
        });
    });

    it('debería notificar al atleta cuando el coach envía un mensaje por socket', (done) => {
        // El handler espera a notifyAthletes antes de llamar al ack, así que al
        // recibirlo la notificación ya está persistida.
        clientSocket.emit('send_message', { planId, text: 'Aviso importante' }, async (response) => {
            expect(response.success).toBe(true);
            const notif = await Notification.findOne({ user: athleteId, type: 'new_message' });
            expect(notif).toBeTruthy();
            expect(notif.message).toContain('Aviso importante');
            expect(await Notification.findOne({ user: coachId, type: 'new_message' })).toBeNull();
            done();
        });
    });

    // ------------------------------------------------------------------
    // Caminos de error: el middleware de autenticación y los dos controles
    // de acceso a la sala (al unirse y en cada mensaje).
    // ------------------------------------------------------------------
    describe('caminos de error', () => {
        const openClients = [];

        // Abre un cliente y resuelve al conectar o rechaza con el connect_error.
        const connect = (opts) => new Promise((resolve, reject) => {
            const socket = Client(`http://localhost:${port}`, { forceNew: true, ...opts });
            openClients.push(socket);
            socket.on('connect', () => resolve(socket));
            socket.on('connect_error', (err) => reject(err));
        });

        // Conecta con el token del coach y emite un evento, devolviendo el ack.
        const emitAs = (token, event, payload) =>
            connect({ auth: { token }, transports: ['websocket'] })
                .then((socket) => new Promise((resolve) => {
                    socket.emit(event, payload, resolve);
                }));

        afterAll(() => {
            openClients.forEach((socket) => socket.close());
        });

        it('rechaza la conexión si no se envía token', async () => {
            await expect(connect({ transports: ['websocket'] }))
                .rejects.toThrow('Authentication error: Token not provided');
        });

        it('rechaza la conexión si el token no es válido', async () => {
            await expect(connect({ auth: { token: 'token-falso' }, transports: ['websocket'] }))
                .rejects.toThrow('Authentication error: Invalid token');
        });

        it('acepta el token en la cabecera Authorization', async () => {
            // El middleware admite handshake.auth.token o la cabecera; esta última
            // solo viaja en el transporte de sondeo, así que no forzamos websocket.
            const socket = await connect({ extraHeaders: { Authorization: `Bearer ${coachToken}` } });
            expect(socket.connected).toBe(true);
        });

        it('no deja unirse a la sala de un plan que no existe', async () => {
            const ack = await emitAs(coachToken, 'join_plan_room', new mongoose.Types.ObjectId().toString());
            expect(ack.error).toBe('Plan no encontrado');
        });

        it('no deja unirse a la sala a quien no pertenece al plan', async () => {
            // El administrador no accede al contenido de los planes (canAccessPlan).
            const ack = await emitAs(adminToken, 'join_plan_room', planId);
            expect(ack.error).toBe('No tienes acceso a este plan');
        });

        it('devuelve un error interno si el identificador del plan no es válido', async () => {
            const ack = await emitAs(coachToken, 'join_plan_room', 'no-es-un-id');
            expect(ack.error).toBe('Error interno del servidor');
        });

        it('rechaza un mensaje vacío o compuesto solo de espacios', async () => {
            const vacio = await emitAs(coachToken, 'send_message', { planId, text: '   ' });
            expect(vacio.error).toBe('El mensaje no puede estar vacío');

            const sinTexto = await emitAs(coachToken, 'send_message', { planId });
            expect(sinTexto.error).toBe('El mensaje no puede estar vacío');
        });

        it('rechaza un mensaje dirigido a un plan que no existe', async () => {
            const ack = await emitAs(coachToken, 'send_message', {
                planId: new mongoose.Types.ObjectId().toString(),
                text: 'Hola',
            });
            expect(ack.error).toBe('Plan no encontrado');
        });

        it('rechaza el mensaje de quien no pertenece al plan', async () => {
            const ack = await emitAs(adminToken, 'send_message', { planId, text: 'Hola' });
            expect(ack.error).toBe('No tienes acceso para enviar en este plan');
        });

        it('devuelve un error interno si el plan del mensaje no es un identificador válido', async () => {
            const ack = await emitAs(coachToken, 'send_message', { planId: 'no-es-un-id', text: 'Hola' });
            expect(ack.error).toBe('Error interno al enviar mensaje');
        });
    });
});
