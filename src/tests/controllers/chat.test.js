import request from 'supertest';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import TrainingPlan from '../../models/templates/TrainingPlan.js';
import Message from '../../models/Message.js';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

describe('Chat Controller REST API', () => {
    let app, coachToken, athleteToken, coachId, athleteId, otherUserToken;
    let planId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_chat_ctrl');
        ({ app, coachToken, athleteToken, coachId, athleteId } = env);

        // Crear un usuario extra que no está en el plan
        const otherUser = await User.create({
            name: 'Other User',
            email: 'other@test.com',
            password: 'password123',
            role: 'athlete',
            isVerified: true
        });
        const resOther = await request(app).post('/api/users/login').send({ email: 'other@test.com', password: 'password123' });
        otherUserToken = resOther.body.token;

        // Crear un plan
        const resPlan = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan Test Chat', startDate: new Date(), endDate: new Date() });
        planId = resPlan.body.plan._id;

        // Enroll athlete
        await request(app).post(`/api/training/plans/${planId}/enroll`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ athleteId });
    }, 60000);

    afterAll(async () => {
        await teardownTestEnv();
    });

    it('debería permitir al coach enviar un mensaje al plan', async () => {
        const res = await request(app)
            .post(`/api/training/plans/${planId}/chat`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ text: 'Hola a todos' });

        expect(res.status).toBe(201);
        expect(res.body.message.text).toBe('Hola a todos');
    });

    it('debería permitir al atleta enviar un mensaje', async () => {
        const res = await request(app)
            .post(`/api/training/plans/${planId}/chat`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ text: 'Hola Coach' });

        expect(res.status).toBe(201);
        expect(res.body.message.text).toBe('Hola Coach');
    });

    it('debería prohibir enviar mensaje a un usuario ajeno al plan', async () => {
        const res = await request(app)
            .post(`/api/training/plans/${planId}/chat`)
            .set('Authorization', `Bearer ${otherUserToken}`)
            .send({ text: 'Spy' });

        expect(res.status).toBe(403);
    });

    it('debería obtener el historial de mensajes del plan', async () => {
        const res = await request(app)
            .get(`/api/training/plans/${planId}/chat`)
            .set('Authorization', `Bearer ${coachToken}`);

        expect(res.status).toBe(200);
        expect(res.body.messages).toHaveLength(2);
        // Los mensajes más recientes primero (dependiendo de cómo implementaste sort y reverse)
        expect(res.body.messages[0].text).toBe('Hola Coach'); // El último enviado
        expect(res.body.messages[1].text).toBe('Hola a todos'); // El primero enviado
    });
});
