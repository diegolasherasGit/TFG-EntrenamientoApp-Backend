import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import WorkoutLog from '../../models/logs/WorkoutLog.js';
import TrainingPlan from '../../models/templates/TrainingPlan.js';
import Notification from '../../models/Notification.js';

describe('logController', () => {
    let app, athleteToken, athleteId, workoutId, coachToken, coachId, planId;
    let logId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_log_ctrl');
        ({ app, athleteToken, athleteId, workoutId, coachToken, coachId, planId } = env);
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('logWorkoutResult: success', async () => {
        const r = await request(app).post('/api/training/logs')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ workoutId, athleteId, exercises: [{ name: 'Squat', sets: 3, reps: 10, load: '80' }], completed: true });
        expect(r.status).toBe(201);
        logId = r.body.log._id;
    });
    it('logWorkoutResult: notifica al coach cuando el atleta completa el entreno', async () => {
        await Notification.deleteMany({ user: coachId });
        const r = await request(app).post('/api/training/logs')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ workoutId, athleteId, exercises: [{ name: 'Squat', sets: 3, reps: 10 }], completed: true });
        expect(r.status).toBe(201);
        const notif = await Notification.findOne({ user: coachId, title: 'Entrenamiento completado' });
        expect(notif).toBeTruthy();
        expect(notif.message).toContain('Athlete');
    });
    it('logWorkoutResult: NO notifica al coach si el entreno no se completa', async () => {
        await Notification.deleteMany({ user: coachId });
        await request(app).post('/api/training/logs')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ workoutId, athleteId, exercises: [{ name: 'Squat', sets: 3, reps: 10 }], completed: false });
        const notif = await Notification.findOne({ user: coachId, title: 'Entrenamiento completado' });
        expect(notif).toBeNull();
    });
    it('getAthleteLogs: success', async () => {
        const r = await request(app).get(`/api/training/logs/athlete/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.logs.length).toBeGreaterThanOrEqual(1);
        expect(r.body.logs[0].workout).toHaveProperty('estimatedDuration');
    });
    it('getAthleteLogs: coach NO inscrito -> 403', async () => {
        const r = await request(app).get(`/api/training/logs/athlete/${athleteId}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(403);
    });
    it('getAthleteLogs: coach inscrito ve los logs de su atleta', async () => {
        await TrainingPlan.findByIdAndUpdate(planId, { $addToSet: { athletes: athleteId } });
        const r = await request(app).get(`/api/training/logs/athlete/${athleteId}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
        expect(r.body.logs.length).toBeGreaterThanOrEqual(1);
    });
    it('updateLog: coach inscrito NO puede modificar el log de su atleta -> 403', async () => {
        // Aunque el coach comparta plan activo con el atleta (puede VER sus logs),
        // no es dueño del registro: editar queda reservado al atleta o a un admin.
        const r = await request(app).put(`/api/training/logs/${logId}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ notes: 'Hacked by coach' });
        expect(r.status).toBe(403);
    });
    it('deleteLog: coach inscrito NO puede borrar el log de su atleta -> 403', async () => {
        const r = await request(app).delete(`/api/training/logs/${logId}`)
            .set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(403);
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
