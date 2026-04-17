import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

describe('planController', () => {
    let app, adminToken, coachToken, athleteToken, coachId, athleteId;
    let planId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_plan_ctrl');
        ({ app, adminToken, coachToken, athleteToken, coachId, athleteId } = env);
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('createPlan: success by coach', async () => {
        const r = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan A', startDate: new Date(), endDate: new Date() });
        expect(r.status).toBe(201);
        planId = r.body.plan._id;
    });
    it('createPlan: with unknown athleteIds → 404', async () => {
        const r = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan B', startDate: new Date(), endDate: new Date(), athleteIds: [new mongoose.Types.ObjectId()] });
        expect(r.status).toBe(404);
    });
    it('createPlan: admin with custom coachId', async () => {
        const r = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Plan Admin', startDate: new Date(), endDate: new Date(), coachId });
        expect(r.status).toBe(201);
    });

    it('getAllActivePlans: success', async () => {
        const r = await request(app).get('/api/training/plans').set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.count).toBeGreaterThanOrEqual(2);
    });
    it('getAthletePlans: returns list', async () => {
        const r = await request(app).get(`/api/training/plans/athlete/${athleteId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('getCoachPlans: returns coach plans', async () => {
        const r = await request(app).get(`/api/training/plans/coach/${coachId}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
    });
    it('getPlanById: success', async () => {
        const r = await request(app).get(`/api/training/plans/${planId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('getPlanById: 404 unknown', async () => {
        const r = await request(app).get(`/api/training/plans/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(404);
    });

    it('updatePlan: success by coach', async () => {
        const r = await request(app).put(`/api/training/plans/${planId}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ description: 'Updated' });
        expect(r.status).toBe(200);
    });
    it('updatePlan: athlete → 403', async () => {
        const r = await request(app).put(`/api/training/plans/${planId}`)
            .set('Authorization', `Bearer ${athleteToken}`).send({ description: 'X' });
        expect(r.status).toBe(403);
    });
    it('updatePlan: 404 unknown plan', async () => {
        const r = await request(app).put(`/api/training/plans/${new mongoose.Types.ObjectId()}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ description: 'X' });
        expect(r.status).toBe(404);
    });
    it('updatePlan: admin updates coach field', async () => {
        const r = await request(app).put(`/api/training/plans/${planId}`)
            .set('Authorization', `Bearer ${adminToken}`).send({ name: 'AdminUpdated', coachId });
        expect(r.status).toBe(200);
    });

    it('enrollAthlete: success', async () => {
        const r = await request(app).post(`/api/training/plans/${planId}/enroll`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
    });
    it('enrollAthlete: already enrolled → 400', async () => {
        const r = await request(app).post(`/api/training/plans/${planId}/enroll`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(400);
    });
    it('enrollAthlete: 404 unknown plan', async () => {
        const r = await request(app).post(`/api/training/plans/${new mongoose.Types.ObjectId()}/enroll`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(404);
    });
    it('enrollAthlete: coach without athleteId', async () => {
        const r = await request(app).post(`/api/training/plans/${planId}/enroll`)
            .set('Authorization', `Bearer ${coachToken}`).send({});
        expect([400, 500]).toContain(r.status);
    });

    it('deletePlan: athlete → 403', async () => {
        const r = await request(app).delete(`/api/training/plans/${planId}`).set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(403);
    });
    it('deletePlan: 404 unknown', async () => {
        const r = await request(app).delete(`/api/training/plans/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(404);
    });
    it('deletePlan: success by coach', async () => {
        const r = await request(app).delete(`/api/training/plans/${planId}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
    });
});
