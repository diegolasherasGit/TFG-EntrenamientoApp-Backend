import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import TrainingStats from '../../models/TrainingStats.js';

describe('trainingStatsController', () => {
    let app, adminToken, coachToken, athleteToken, athleteId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_stats_ctrl');
        ({ app, adminToken, coachToken, athleteToken, athleteId } = env);
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('createStats: success', async () => {
        const r = await request(app).post('/api/training/stats')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ userId: athleteId });
        expect(r.status).toBe(201);
    });
    it('createStats: duplicate → 400', async () => {
        const r = await request(app).post('/api/training/stats')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ userId: athleteId });
        expect(r.status).toBe(400);
    });
    it('getStats: success', async () => {
        const r = await request(app).get(`/api/training/stats/user/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('getStats: unauthorized (other user) → 403', async () => {
        const r = await request(app).get(`/api/training/stats/user/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(403);
    });
    it('updateStats: success', async () => {
        const r = await request(app).put(`/api/training/stats/user/${athleteId}`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ totalWorkouts: 10, totalExercises: 50 });
        expect(r.status).toBe(200);
    });
    it('updateStats: unauthorized (other user) → 403', async () => {
        const r = await request(app).put(`/api/training/stats/user/${new mongoose.Types.ObjectId()}`)
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ totalWorkouts: 1 });
        expect(r.status).toBe(403);
    });
    it('getExerciseProgress: missing param → 400', async () => {
        const r = await request(app).get(`/api/training/stats/progress/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(400);
    });
    it('getExerciseProgress: success', async () => {
        const r = await request(app).get(`/api/training/stats/progress/${athleteId}?exercise=Squat`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });

    it('getDashboardStats: athlete', async () => {
        const r = await request(app).get('/api/training/stats/dashboard').set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.role).toBe('athlete');
        expect(r.body.summary).toHaveProperty('totalCompleted');
        expect(r.body.charts).toHaveProperty('weeklyActivity');
    });

    it('getDashboardStats: coach', async () => {
        const r = await request(app).get('/api/training/stats/dashboard').set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
        expect(r.body.role).toBe('coach');
        expect(r.body.charts).toHaveProperty('weeklyTeamActivity');
        expect(r.body.charts).toHaveProperty('athletesAtRisk');
        expect(r.body.summary).toHaveProperty('teamWeeklyAdherence');
        expect(Array.isArray(r.body.insights)).toBe(true);
    });

    it('getDashboardStats: admin', async () => {
        const r = await request(app).get('/api/training/stats/dashboard').set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        expect(r.body.role).toBe('admin');
        expect(r.body.charts).toHaveProperty('usersByRole');
        expect(r.body.charts).toHaveProperty('dailyActivity');
    });
    it('deleteStats: success', async () => {
        const r = await request(app).delete(`/api/training/stats/user/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('deleteStats: unauthorized (other user) → 403', async () => {
        const r = await request(app).delete(`/api/training/stats/user/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(403);
    });

    // catch block
    it('getStats: catch block', async () => {
        const spy = jest.spyOn(TrainingStats, 'findOne').mockRejectedValueOnce(new Error('db'));
        const r = await request(app).get(`/api/training/stats/user/${athleteId}`).set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(500);
        spy.mockRestore();
    });
});
