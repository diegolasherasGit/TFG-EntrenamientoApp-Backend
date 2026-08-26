import request from 'supertest';
import { createServer } from 'http';
import Client from 'socket.io-client';
import app from '../../app.js';
import { initializeSocket } from '../../config/socket.js';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import Notification from '../../models/Notification.js';

describe('Socket.io Chat', () => {
    let io, clientSocket;
    let coachToken, coachId, athleteId, planId;
    let httpServer;
    const port = 3005;

    beforeAll(async () => {
        // Setup base test env
        const env = await setupTestEnv('test_socket_chat');
        ({ coachToken, coachId, athleteId } = env);

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
});
