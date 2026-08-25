import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';

describe('userController', () => {
    let app, adminToken, athleteToken, coachId, athleteId;

    beforeAll(async () => {
        const env = await setupTestEnv();
        ({ app, adminToken, athleteToken, coachId, athleteId } = env);
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    // --- register ---
    it('register: blocks admin/coach role', async () => {
        const r = await request(app).post('/api/users/register').send({ name: 'X', email: 'x@t.com', password: 'Password1', role: 'admin' });
        expect(r.status).toBe(403);
    });
    it('register: rejects weak password', async () => {
        const r = await request(app).post('/api/users/register').send({ name: 'X', email: 'x@t.com', password: 'bad' });
        expect(r.status).toBe(400);
    });
    it('register: rejects duplicate email', async () => {
        const r = await request(app).post('/api/users/register').send({ name: 'X', email: 'athlete@test.com', password: 'Password1' });
        expect(r.status).toBe(400);
    });
    it('register: success generates code and requireVerification', async () => {
        const r = await request(app).post('/api/users/register').send({ name: 'OTP Test', email: 'otp@t.com', password: 'Password1' });
        expect(r.status).toBe(201);
        expect(r.body.requireVerification).toBe(true);
    });

    // --- verifyEmail ---
    it('verifyEmail: rejects missing parameters', async () => {
        const r = await request(app).post('/api/users/verify-email').send({ email: 'otp@t.com' });
        expect(r.status).toBe(400);
    });
    it('verifyEmail: rejects invalid code', async () => {
        const r = await request(app).post('/api/users/verify-email').send({ email: 'otp@t.com', code: '000000' });
        expect(r.status).toBe(400);
    });
    it('verifyEmail: success returns token y deja las notificaciones activadas', async () => {
        const user = await User.findOne({ email: 'otp@t.com' });
        const code = user.verificationCode;
        // Forzamos notifications OFF para comprobar que verificar el correo las
        // reactiva por defecto (no depender solo del default del esquema).
        user.notificationsEnabled = false;
        await user.save({ validateBeforeSave: false });
        const r = await request(app).post('/api/users/verify-email').send({ email: 'otp@t.com', code });
        expect(r.status).toBe(200);
        expect(r.body.token).toBeDefined();
        expect(r.body.user.email).toBe('otp@t.com');
        expect(r.body.user.notificationsEnabled).toBe(true);
        const verified = await User.findOne({ email: 'otp@t.com' });
        expect(verified.notificationsEnabled).toBe(true);
    });

    // --- forgot / reset password ---
    it('forgotPassword: returns generic message for unknown email', async () => {
        const r = await request(app).post('/api/users/forgot-password').send({ email: 'noexiste@test.com' });
        expect(r.status).toBe(200);
        expect(r.body.message).toBeDefined();
    });
    it('forgotPassword: sends code for existing user', async () => {
        const r = await request(app).post('/api/users/forgot-password').send({ email: 'otp@t.com' });
        expect(r.status).toBe(200);
        const user = await User.findOne({ email: 'otp@t.com' });
        expect(user.verificationCode).toBeDefined();
        expect(user.verificationCode.length).toBe(6);
    });
    it('resetPassword: rejects invalid code', async () => {
        const r = await request(app).post('/api/users/reset-password').send({
            email: 'otp@t.com',
            code: '000000',
            password: 'ResetPass1',
        });
        expect(r.status).toBe(400);
    });
    it('resetPassword: success updates password and returns token', async () => {
        await request(app).post('/api/users/forgot-password').send({ email: 'otp@t.com' });
        const user = await User.findOne({ email: 'otp@t.com' });
        const code = user.verificationCode;
        const r = await request(app).post('/api/users/reset-password').send({
            email: 'otp@t.com',
            code,
            password: 'ResetPass1',
        });
        expect(r.status).toBe(200);
        expect(r.body.token).toBeDefined();
        const loginRes = await request(app).post('/api/users/login').send({
            email: 'otp@t.com',
            password: 'ResetPass1',
        });
        expect(loginRes.status).toBe(200);
    });

    // --- createPrivilegedUser ---
    it('privileged: creates a coach', async () => {
        const r = await request(app).post('/api/users/privileged')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Coach2', email: 'coach2@test.com', password: 'Password1', role: 'coach' });
        expect(r.status).toBe(201);
    });
    it('privileged: rejects athlete role', async () => {
        const r = await request(app).post('/api/users/privileged')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'X', email: 'x@t.com', password: 'Password1', role: 'athlete' });
        expect(r.status).toBe(400);
    });
    it('privileged: rejects weak password', async () => {
        const r = await request(app).post('/api/users/privileged')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'X', email: 'x@t.com', password: 'bad', role: 'coach' });
        expect(r.status).toBe(400);
    });
    it('privileged: rejects duplicate', async () => {
        const r = await request(app).post('/api/users/privileged')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'X', email: 'coach@test.com', password: 'Password1', role: 'coach' });
        expect(r.status).toBe(400);
    });

    // --- login ---
    it('login: rejects verified FALSE account -> 403', async () => {
        await request(app).post('/api/users/register').send({ name: 'Fail Log', email: 'faillog@t.com', password: 'Password1' });
        const r = await request(app).post('/api/users/login').send({ email: 'faillog@t.com', password: 'Password1' });
        expect(r.status).toBe(403);
    });
    it('login: wrong email → 401', async () => {
        const r = await request(app).post('/api/users/login').send({ email: 'nope@t.com', password: 'Password1' });
        expect(r.status).toBe(401);
    });
    it('login: wrong password → 401', async () => {
        const r = await request(app).post('/api/users/login').send({ email: 'athlete@test.com', password: 'Wrong1' });
        expect(r.status).toBe(401);
    });
    it('login: deleted user → 401', async () => {
        await User.findByIdAndUpdate(athleteId, { isDeleted: true });
        const r = await request(app).post('/api/users/login').send({ email: 'athlete@test.com', password: 'Password1' });
        expect(r.status).toBe(401);
        await User.findByIdAndUpdate(athleteId, { isDeleted: false });
    });

    // --- getProfile ---
    it('getProfile: success', async () => {
        const r = await request(app).get(`/api/users/profile/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('getProfile: 404 unknown id', async () => {
        const r = await request(app).get(`/api/users/profile/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(404);
    });

    // --- updateUser ---
    it('updateUser: athlete updates own name', async () => {
        const r = await request(app).put(`/api/users/profile/${athleteId}`)
            .set('Authorization', `Bearer ${athleteToken}`).send({ name: 'AthUpdated' });
        expect(r.status).toBe(200);
    });
    it('updateUser: athlete cannot update other user → 403', async () => {
        const r = await request(app).put(`/api/users/profile/${coachId}`)
            .set('Authorization', `Bearer ${athleteToken}`).send({ name: 'X' });
        expect(r.status).toBe(403);
    });
    it('updateUser: password change with wrong old password → 401', async () => {
        const r = await request(app).put(`/api/users/profile/${athleteId}`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ password: 'NewPass1', oldPassword: 'WrongOld1' });
        expect(r.status).toBe(401);
    });
    it('updateUser: weak new password → 400', async () => {
        const r = await request(app).put(`/api/users/profile/${athleteId}`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ password: 'bad', oldPassword: 'Password1' });
        expect(r.status).toBe(400);
    });
    it('updateUser: password change success', async () => {
        const r = await request(app).put(`/api/users/profile/${athleteId}`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ password: 'NewPass1', oldPassword: 'Password1' });
        expect(r.status).toBe(200);
        const login = await request(app).post('/api/users/login').send({ email: 'athlete@test.com', password: 'NewPass1' });
        athleteToken = login.body.token;
    });

    // --- deleteUser & restoreUser ---
    it('deleteUser: athlete cannot delete other → 403', async () => {
        const r = await request(app).delete(`/api/users/profile/${coachId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(403);
    });
    it('deleteUser: 404 for unknown id (admin)', async () => {
        const r = await request(app).delete(`/api/users/profile/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(404);
    });
    it('deleteUser: self-delete success', async () => {
        const r = await request(app).delete(`/api/users/profile/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('restoreUser: success', async () => {
        const r = await request(app).patch(`/api/users/profile/${athleteId}/restore`).set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        const login = await request(app).post('/api/users/login').send({ email: 'athlete@test.com', password: 'NewPass1' });
        athleteToken = login.body.token;
    });
    it('restoreUser: 404 for unknown id', async () => {
        const r = await request(app).patch(`/api/users/profile/${new mongoose.Types.ObjectId()}/restore`).set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(404);
    });

    // --- googleLogin ---
    it('googleLogin: missing token → 400', async () => {
        const r = await request(app).post('/api/users/google-login').send({});
        expect(r.status).toBe(400);
    });
    it('googleLogin: invalid token → 401', async () => {
        const r = await request(app).post('/api/users/google-login').send({ idToken: 'invalid-token' });
        expect(r.status).toBe(401);
    });
    it('googleLogin: new user creation (mocked)', async () => {
        const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
            getPayload: () => ({ sub: 'g123', email: 'googleuser@test.com', name: 'G User', picture: 'http://pic' })
        });
        const r = await request(app).post('/api/users/google-login').send({ idToken: 'valid' });
        expect(r.status).toBe(200);
        expect(r.body.user.email).toBe('googleuser@test.com');
        spy.mockRestore();
    });
    it('googleLogin: existing user merge (mocked)', async () => {
        const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
            getPayload: () => ({ sub: 'g456', email: 'athlete@test.com', name: 'Athlete', picture: 'http://pic2' })
        });
        const r = await request(app).post('/api/users/google-login').send({ idToken: 'valid' });
        expect(r.status).toBe(200);
        spy.mockRestore();
    });

    // --- uploadPhoto & removePhoto ---
    it('uploadPhoto: missing base64 → 400', async () => {
        const r = await request(app).post(`/api/users/profile/${athleteId}/photo`)
            .set('Authorization', `Bearer ${athleteToken}`).send({});
        expect(r.status).toBe(400);
    });
    it('uploadPhoto: 404 unknown user', async () => {
        const r = await request(app).post(`/api/users/profile/${new mongoose.Types.ObjectId()}/photo`)
            .set('Authorization', `Bearer ${adminToken}`).send({ photoBase64: 'abc', mimeType: 'image/png' });
        expect(r.status).toBe(404);
    });
    it('uploadPhoto: success', async () => {
        if (!fs.existsSync('uploads')) { fs.mkdirSync('uploads'); }
        const r = await request(app).post(`/api/users/profile/${athleteId}/photo`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ photoBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', mimeType: 'image/png' });
        expect(r.status).toBe(200);
        expect(r.body.photo).toBeDefined();
    });
    it('uploadPhoto: replaces existing local photo', async () => {
        const r = await request(app).post(`/api/users/profile/${athleteId}/photo`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ photoBase64: 'abc123', mimeType: 'image/jpeg' });
        expect(r.status).toBe(200);
    });
    it('removePhoto: success', async () => {
        const r = await request(app).delete(`/api/users/profile/${athleteId}/photo`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.user.photo).toBeNull();
    });
    it('removePhoto: 404 unknown user', async () => {
        const r = await request(app).delete(`/api/users/profile/${new mongoose.Types.ObjectId()}/photo`).set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(404);
    });

    // --- getAllUsers (gestión del admin) ---
    it('getAllUsers: success by admin (solo activos)', async () => {
        const r = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        expect(Array.isArray(r.body.users)).toBe(true);
        expect(r.body.count).toBe(r.body.users.length);
        // Ningún usuario borrado en la lista
        expect(r.body.users.every(u => u.isDeleted !== true)).toBe(true);
    });

    it('getAllUsers: forbidden for athlete (403)', async () => {
        const r = await request(app).get('/api/users').set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(403);
    });

    // --- catch block ---
    it('register catch block', async () => {
        const spy = jest.spyOn(User, 'findOne').mockRejectedValueOnce(new Error('db'));
        const r = await request(app).post('/api/users/register').send({ name: 'X', email: 'x@x.com', password: 'Password1' });
        expect(r.status).toBe(500);
        spy.mockRestore();
    });

    // --- membership gating (vía A: gestión manual del abono por admin) ---
    describe('membership', () => {
        let noPlanId, noPlanToken;

        beforeAll(async () => {
            // Atleta sin abono: no debe poder acceder al contenido
            // dni: el atleta ya lo aportó desde la app; el admin solo puede activar
            // abonos de cuentas que tengan DNI (verificación frente a Bulderland).
            await User.create({ name: 'NoPlan', email: 'noplan@test.com', password: 'Password1', role: 'athlete', isVerified: true, dni: '00000000T' });
            const login = await request(app).post('/api/users/login').send({ email: 'noplan@test.com', password: 'Password1' });
            noPlanToken = login.body.token;
            noPlanId = login.body.user.id ?? login.body.user._id;
        });

        it('athlete sin abono recibe 403 NO_ACTIVE_MEMBERSHIP en contenido', async () => {
            const r = await request(app).get('/api/training/plans').set('Authorization', `Bearer ${noPlanToken}`);
            expect(r.status).toBe(403);
            expect(r.body.code).toBe('NO_ACTIVE_MEMBERSHIP');
        });

        it('atleta con abono activo (setup) sí accede al contenido', async () => {
            const r = await request(app).get('/api/training/plans').set('Authorization', `Bearer ${athleteToken}`);
            expect(r.status).toBe(200);
        });

        it('un no-admin no puede modificar el abono (403)', async () => {
            const r = await request(app)
                .patch(`/api/users/profile/${noPlanId}/membership`)
                .set('Authorization', `Bearer ${athleteToken}`)
                .send({ status: 'active' });
            expect(r.status).toBe(403);
        });

        it('admin activa el abono con un plan y se calcula la caducidad', async () => {
            const upd = await request(app)
                .patch(`/api/users/profile/${noPlanId}/membership`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'active', plan: 'mensual' });
            expect(upd.status).toBe(200);
            expect(upd.body.user.membership.status).toBe('active');
            expect(upd.body.user.membership.plan).toBe('mensual');
            // validUntil se calcula automáticamente (~30 días en el futuro)
            const until = new Date(upd.body.user.membership.validUntil).getTime();
            const days = (until - Date.now()) / (1000 * 60 * 60 * 24);
            expect(days).toBeGreaterThan(29);
            expect(days).toBeLessThan(31);

            // El atleta recibe una notificación de que su abono ha sido activado
            const notif = await Notification.findOne({ user: noPlanId, title: 'Abono activado' });
            expect(notif).not.toBeNull();

            const r = await request(app).get('/api/training/plans').set('Authorization', `Bearer ${noPlanToken}`);
            expect(r.status).toBe(200);
        });

        it('no se puede activar sin elegir plan (400)', async () => {
            const upd = await request(app)
                .patch(`/api/users/profile/${noPlanId}/membership`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'active' });
            expect(upd.status).toBe(400);
        });

        it('no se puede activar el abono de un usuario sin DNI', async () => {
            await User.create({ name: 'SinDni', email: 'sindni@test.com', password: 'Password1', role: 'athlete', isVerified: true });
            const u = await User.findOne({ email: 'sindni@test.com' });
            const upd = await request(app)
                .patch(`/api/users/profile/${u._id}/membership`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'active', plan: 'mensual' });
            expect(upd.status).toBe(400);
            const after = await User.findById(u._id).select('membership');
            expect(after.membership?.status).not.toBe('active');
        });

        it('abono caducado (validUntil pasado) no da acceso', async () => {
            // Caducidad en el pasado: se fija directamente en la BD (el API ya no
            // acepta validUntil del cliente, se deriva del plan).
            await User.findByIdAndUpdate(noPlanId, {
                'membership.status': 'active',
                'membership.validUntil': new Date('2000-01-01')
            });
            const r = await request(app).get('/api/training/plans').set('Authorization', `Bearer ${noPlanToken}`);
            expect(r.status).toBe(403);
        });

        it('expireMemberships caduca los abonos vencidos y avisa', async () => {
            const { expireMemberships } = await import('../../utils/expireMemberships.js');
            await User.create({
                name: 'PorCaducar', email: 'caduca@test.com', password: 'Password1',
                role: 'athlete', isVerified: true, dni: '11111111H',
                membership: { status: 'active', plan: 'mensual', validUntil: new Date('2000-01-01') }
            });
            const target = await User.findOne({ email: 'caduca@test.com' });

            const count = await expireMemberships();
            expect(count).toBeGreaterThanOrEqual(1);

            const after = await User.findById(target._id).select('membership');
            expect(after.membership.status).toBe('expired');
            const notif = await Notification.findOne({ user: target._id, title: 'Abono caducado' });
            expect(notif).not.toBeNull();
        });

        it('requestMembership: el usuario aporta su DNI (pending), se guarda y sigue sin acceso', async () => {
            await User.create({ name: 'Pend', email: 'pend@test.com', password: 'Password1', role: 'athlete', isVerified: true });
            const login = await request(app).post('/api/users/login').send({ email: 'pend@test.com', password: 'Password1' });
            const token = login.body.token;

            const reqRes = await request(app)
                .post('/api/users/membership/request')
                .set('Authorization', `Bearer ${token}`)
                .send({ dni: '12345678Z' });
            expect(reqRes.status).toBe(200);
            expect(reqRes.body.membership.status).toBe('pending');

            // El DNI queda guardado (normalizado) en la cuenta
            const saved = await User.findOne({ email: 'pend@test.com' });
            expect(saved.dni).toBe('12345678Z');

            // Pendiente no da acceso al contenido
            const content = await request(app).get('/api/training/plans').set('Authorization', `Bearer ${token}`);
            expect(content.status).toBe(403);

            // getMyMembership refleja el estado pendiente
            const me = await request(app).get('/api/users/membership').set('Authorization', `Bearer ${token}`);
            expect(me.status).toBe(200);
            expect(me.body.membership.status).toBe('pending');
        });

        it('requestMembership: rechaza un DNI con letra de control inválida', async () => {
            const login = await request(app).post('/api/users/login').send({ email: 'pend@test.com', password: 'Password1' });
            const r = await request(app)
                .post('/api/users/membership/request')
                .set('Authorization', `Bearer ${login.body.token}`)
                .send({ dni: '12345678A' });
            expect(r.status).toBe(400);
        });

        it('requestMembership: rechaza un DNI ya registrado en otra cuenta', async () => {
            await User.create({ name: 'Otro', email: 'otro@test.com', password: 'Password1', role: 'athlete', isVerified: true });
            const login = await request(app).post('/api/users/login').send({ email: 'otro@test.com', password: 'Password1' });
            const r = await request(app)
                .post('/api/users/membership/request')
                .set('Authorization', `Bearer ${login.body.token}`)
                .send({ dni: '12345678Z' }); // ya usado por pend@test.com en el test anterior
            expect(r.status).toBe(400);
        });
    });
});
