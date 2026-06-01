import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import User from '../../models/User.js';
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
    it('verifyEmail: success returns token', async () => {
        const user = await User.findOne({ email: 'otp@t.com' });
        const code = user.verificationCode;
        const r = await request(app).post('/api/users/verify-email').send({ email: 'otp@t.com', code });
        expect(r.status).toBe(200);
        expect(r.body.token).toBeDefined();
        expect(r.body.user.email).toBe('otp@t.com');
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

    // --- catch block ---
    it('register catch block', async () => {
        const spy = jest.spyOn(User, 'findOne').mockRejectedValueOnce(new Error('db'));
        const r = await request(app).post('/api/users/register').send({ name: 'X', email: 'x@x.com', password: 'Password1' });
        expect(r.status).toBe(500);
        spy.mockRestore();
    });
});
