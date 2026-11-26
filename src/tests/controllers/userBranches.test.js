import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

/**
 * Caminos de userController que la suite principal no recorre: cuentas creadas
 * con Google (sin contraseña), desactivación del abono, y las acciones que un
 * administrador realiza sobre la cuenta de otro usuario.
 */
describe('userController — caminos poco frecuentes', () => {
    let adminToken, coachToken, athleteToken, athleteId;

    beforeAll(async () => {
        ({ adminToken, coachToken, athleteToken, athleteId } = await setupTestEnv());
    }, 60000);

    afterAll(teardownTestEnv);

    // --- Cuentas de Google: existen pero no tienen contraseña que restablecer ---
    describe('recuperación de contraseña en cuentas de Google', () => {
        it('forgotPassword no genera código para una cuenta sin contraseña', async () => {
            await User.create({ name: 'Solo Google', email: 'solo.google@test.com', googleId: 'g-1', isVerified: true });

            const res = await request(app).post('/api/users/forgot-password')
                .send({ email: 'solo.google@test.com' });

            // Responde el mensaje genérico igual que con un correo desconocido,
            // para no revelar qué cuentas existen.
            expect(res.status).toBe(200);
            const user = await User.findOne({ email: 'solo.google@test.com' });
            expect(user.verificationCode).toBeUndefined();
        });

        it('resetPassword rechaza una cuenta sin contraseña aunque el código sea válido', async () => {
            await User.create({
                name: 'Solo Google 2', email: 'solo.google2@test.com', googleId: 'g-2', isVerified: true,
                verificationCode: '123456', verificationCodeExpires: Date.now() + 10 * 60 * 1000,
            });

            const res = await request(app).post('/api/users/reset-password')
                .send({ email: 'solo.google2@test.com', code: '123456', password: 'Password1' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Google');
        });
    });

    it('privileged: un admin puede crear otro administrador', async () => {
        const res = await request(app).post('/api/users/privileged')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Admin Dos', email: 'admin2@test.com', password: 'Password1', role: 'admin' });

        expect(res.status).toBe(201);
    });

    it('getProfile: un coach puede consultar el perfil de un atleta', async () => {
        const res = await request(app).get(`/api/users/profile/${athleteId}`)
            .set('Authorization', `Bearer ${coachToken}`);

        expect(res.status).toBe(200);
        expect(res.body.password).toBeUndefined();
        expect(res.body.verificationCode).toBeUndefined();
    });

    // --- Abono: solicitud repetida y desactivación ---
    describe('abono', () => {
        it('requestMembership rechaza la solicitud si ya hay un abono activo', async () => {
            // El atleta del entorno de pruebas arranca con el abono activo.
            const res = await request(app).post('/api/users/membership/request')
                .set('Authorization', `Bearer ${athleteToken}`)
                .send({ dni: '12345678Z' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Ya tienes un abono activo');
        });

        it('requestMembership acepta que el usuario reenvíe su propio DNI', async () => {
            await User.findByIdAndUpdate(athleteId, { dni: '12345678Z', membership: { status: 'none' } });

            const res = await request(app).post('/api/users/membership/request')
                .set('Authorization', `Bearer ${athleteToken}`)
                .send({ dni: '12345678Z' });

            expect(res.status).toBe(200);
            expect(res.body.membership.status).toBe('pending');
        });

        it('updateMembership devuelve 404 si el usuario no existe', async () => {
            const res = await request(app).patch(`/api/users/profile/${new mongoose.Types.ObjectId()}/membership`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'active', plan: 'mensual' });

            expect(res.status).toBe(404);
        });

        it('updateMembership al desactivar limpia el plan y la caducidad', async () => {
            const res = await request(app).patch(`/api/users/profile/${athleteId}/membership`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'expired' });

            expect(res.status).toBe(200);
            expect(res.body.user.membership.status).toBe('expired');
            expect(res.body.user.membership.plan).toBeUndefined();
            expect(res.body.user.membership.validUntil).toBeUndefined();

            const aviso = await Notification.findOne({ user: athleteId, title: 'Abono actualizado' });
            expect(aviso).toBeTruthy();
        });
    });

    // --- Acciones de un administrador sobre la cuenta de otro usuario ---
    describe('un administrador gestiona la cuenta de otro usuario', () => {
        let otroId;

        beforeAll(async () => {
            const otro = await User.create({
                name: 'Usuario Editable', email: 'editable@test.com',
                password: 'Password1', role: 'athlete', isVerified: true,
            });
            otroId = otro._id.toString();
        });

        it('updateUser cambia nombre, correo, rol y preferencias de aviso a la vez', async () => {
            const res = await request(app).put(`/api/users/profile/${otroId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Usuario Renombrado',
                    email: 'renombrado@test.com',
                    role: 'coach',
                    notificationsEnabled: false,
                    expoPushToken: 'ExponentPushToken[test]',
                });

            expect(res.status).toBe(200);
            const user = await User.findById(otroId);
            expect(user.name).toBe('Usuario Renombrado');
            expect(user.email).toBe('renombrado@test.com');
            expect(user.role).toBe('coach');
            expect(user.notificationsEnabled).toBe(false);
            expect(user.expoPushToken).toBe('ExponentPushToken[test]');
        });

        it('updateUser devuelve 404 si el usuario no existe', async () => {
            const res = await request(app).put(`/api/users/profile/${new mongoose.Types.ObjectId()}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Da igual' });

            expect(res.status).toBe(404);
        });

        it('uploadPhoto y removePhoto sobre la cuenta de otro usuario', async () => {
            const subida = await request(app).post(`/api/users/profile/${otroId}/photo`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ photoBase64: 'abc123', mimeType: 'image/png' });
            expect(subida.status).toBe(200);
            expect(subida.body.photo).toBeDefined();

            const borrado = await request(app).delete(`/api/users/profile/${otroId}/photo`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(borrado.status).toBe(200);
            expect(borrado.body.user.photo).toBeNull();
        });
    });
});
