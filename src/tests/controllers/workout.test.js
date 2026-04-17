import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

describe('workoutController', () => {
    let app, adminToken, coachToken, athleteToken, planId;
    let workoutId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_workout_ctrl');
        ({ app, adminToken, coachToken, athleteToken, planId } = env);
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('createWorkout: success by coach', async () => {
        const r = await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ planId, date: new Date(), name: 'Workout A', exercises: [{ name: 'Squat' }] });
        expect(r.status).toBe(201);
        workoutId = r.body.workout._id;
    });
    it('createWorkout: 404 unknown plan', async () => {
        const r = await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ planId: new mongoose.Types.ObjectId(), date: new Date(), name: 'X' });
        expect(r.status).toBe(404);
    });
    it('createWorkout: athlete → 403 (restrictTo)', async () => {
        const r = await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ planId, date: new Date(), name: 'X' });
        expect(r.status).toBe(403);
    });

    it('getWorkoutById: success', async () => {
        const r = await request(app).get(`/api/training/workouts/${workoutId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('getWorkoutById: 404', async () => {
        const r = await request(app).get(`/api/training/workouts/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(404);
    });

    it('getPlanWorkouts: success', async () => {
        const r = await request(app).get(`/api/training/workouts/plan/${planId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.count).toBeGreaterThanOrEqual(1);
    });

    it('getMyCalendarWorkouts: athlete', async () => {
        const r = await request(app).get('/api/training/workouts/calendar/my-calendar').set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('getMyCalendarWorkouts: coach', async () => {
        const r = await request(app).get('/api/training/workouts/calendar/my-calendar').set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
    });
    it('getMyCalendarWorkouts: admin', async () => {
        const r = await request(app).get('/api/training/workouts/calendar/my-calendar').set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
    });

    it('updateWorkout: success', async () => {
        const r = await request(app).put(`/api/training/workouts/${workoutId}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ name: 'Updated Workout' });
        expect(r.status).toBe(200);
    });
    it('updateWorkout: 404 unknown', async () => {
        const r = await request(app).put(`/api/training/workouts/${new mongoose.Types.ObjectId()}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ name: 'X' });
        expect(r.status).toBe(404);
    });

    it('deleteWorkout: 404 unknown', async () => {
        const r = await request(app).delete(`/api/training/workouts/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(404);
    });
    it('deleteWorkout: success', async () => {
        const r = await request(app).delete(`/api/training/workouts/${workoutId}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
    });
});
