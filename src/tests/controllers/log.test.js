import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import WorkoutLog from '../../models/logs/WorkoutLog.js';

describe('logController', () => {
    let app, athleteToken, athleteId, workoutId;
    let logId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_log_ctrl');
        ({ app, athleteToken, athleteId, workoutId } = env);
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('logWorkoutResult: success', async () => {
        const r = await request(app).post('/api/training/logs')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ workoutId, athleteId, exercises: [{ name: 'Squat', sets: 3, reps: 10, load: '80' }], completed: true });
        expect(r.status).toBe(201);
        logId = r.body.log._id;
    });
    it('getAthleteLogs: success', async () => {
        const r = await request(app).get(`/api/training/logs/athlete/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.logs.length).toBeGreaterThanOrEqual(1);
        expect(r.body.logs[0].workout).toHaveProperty('estimatedDuration');
    });
    it('updateLog: success', async () => {
        const r = await request(app).put(`/api/training/logs/${logId}`)
            .set('Authorization', `Bearer ${athleteToken}`).send({ notes: 'Felt great' });
        expect(r.status).toBe(200);
    });
    it('updateLog: 404 unknown', async () => {
        const r = await request(app).put(`/api/training/logs/${new mongoose.Types.ObjectId()}`)
            .set('Authorization', `Bearer ${athleteToken}`).send({ notes: 'x' });
        expect(r.status).toBe(404);
    });
    it('deleteLog: success', async () => {
        const r = await request(app).delete(`/api/training/logs/${logId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('deleteLog: 404 unknown', async () => {
        const r = await request(app).delete(`/api/training/logs/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(404);
    });

    // catch block
    it('logWorkoutResult: catch block', async () => {
        const spy = jest.spyOn(WorkoutLog.prototype, 'save').mockRejectedValueOnce(new Error('db'));
        const r = await request(app).post('/api/training/logs').set('Authorization', `Bearer ${athleteToken}`)
            .send({ workoutId, athleteId, exercises: [] });
        expect(r.status).toBe(500);
        spy.mockRestore();
    });
});
