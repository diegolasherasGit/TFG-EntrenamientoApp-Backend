import request from 'supertest';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

describe('planController', () => {
    let app, adminToken, coachToken, athleteToken, coachId, athleteId;
    let planId, otherCoachToken;

    beforeAll(async () => {
        const env = await setupTestEnv('test_plan_ctrl');
        ({ app, adminToken, coachToken, athleteToken, coachId, athleteId } = env);

        // Crear un segundo coach para pruebas de permisos
        await User.create({ name: 'Coach 2', email: 'coach2@test.com', password: 'Password1', role: 'coach', isVerified: true });
        const res = await request(app).post('/api/users/login').send({ email: 'coach2@test.com', password: 'Password1' });
        otherCoachToken = res.body.token;
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('createPlan: success by coach', async () => {
        const r = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan A', startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        expect(r.status).toBe(201);
        planId = r.body.plan._id;
    });
    it('createPlan: with unknown athleteIds → 404', async () => {
        const r = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan B', startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), athleteIds: [new mongoose.Types.ObjectId()] });
        expect(r.status).toBe(404);
    });
    it('createPlan: admin with custom coachId', async () => {
        const r = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Plan Admin', startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), coachId });
        expect(r.status).toBe(201);
    });

    it('createPlan: 400 si inicio y fin son el mismo día', async () => {
        const r = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan MismoDia', startDate: '2026-03-01', endDate: '2026-03-01' });
        expect(r.status).toBe(400);
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

    it('updatePlan: 400 si una sesión queda fuera del nuevo rango', async () => {
        // Plan amplio con una sesión a mitad de rango
        const planRes = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan Rango', startDate: '2026-01-01', endDate: '2026-12-31' });
        const rangePlanId = planRes.body.plan._id;
        await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ planId: rangePlanId, date: '2026-06-15', name: 'Sesión media' });

        // Estrechar el rango dejando la sesión fuera → 400
        const bad = await request(app).put(`/api/training/plans/${rangePlanId}`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ startDate: '2026-07-01', endDate: '2026-12-31' });
        expect(bad.status).toBe(400);

        // Estrechar el rango manteniendo la sesión dentro → 200
        const ok = await request(app).put(`/api/training/plans/${rangePlanId}`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ startDate: '2026-06-01', endDate: '2026-06-30' });
        expect(ok.status).toBe(200);
    });
    it('updatePlan: 400 si la fecha de inicio es posterior a la de fin', async () => {
        const r = await request(app).put(`/api/training/plans/${planId}`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ startDate: '2026-12-31', endDate: '2026-01-01' });
        expect(r.status).toBe(400);
    });
    it('updatePlan: 400 si inicio y fin son el mismo día', async () => {
        const r = await request(app).put(`/api/training/plans/${planId}`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ startDate: '2026-05-05', endDate: '2026-05-05' });
        expect(r.status).toBe(400);
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

    it('updatePlan: separate coach → 403', async () => {
        const r = await request(app).put(`/api/training/plans/${planId}`)
            .set('Authorization', `Bearer ${otherCoachToken}`).send({ name: 'Hacked' });
        expect(r.status).toBe(403);
    });

    it('enrollAthlete: success (coach enrolls athlete)', async () => {
        // Primero desenrolamos (o usamos un nuevo plan para evitar conflicto)
        const p = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan Enroll', startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        const newPlanId = p.body.plan._id;

        const r = await request(app).post(`/api/training/plans/${newPlanId}/enroll`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ athleteId });
        expect(r.status).toBe(200);
        expect(r.body.plan.athletes).toContain(athleteId);
    });

    it('enrollAthlete: error if no athleteId provided by coach', async () => {
        const r = await request(app).post(`/api/training/plans/${planId}/enroll`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({});
        expect(r.status).toBe(400);
    });

    it('getPlanAthletesProgress: distingue quién tiene ya un entreno completado en el plan', async () => {
        const p = await request(app).post('/api/training/plans')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ name: 'Plan Progreso', startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        const progressPlanId = p.body.plan._id;

        await request(app).post(`/api/training/plans/${progressPlanId}/enroll`)
            .set('Authorization', `Bearer ${athleteToken}`);

        const w = await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ planId: progressPlanId, date: new Date(), name: 'Sesión 1' });
        const workoutId = w.body.workout._id;

        // Sin logs todavía: nadie completado
        const before = await request(app).get(`/api/training/plans/${progressPlanId}/athletes-progress`)
            .set('Authorization', `Bearer ${coachToken}`);
        expect(before.status).toBe(200);
        expect(before.body.completedAthleteIds).toEqual([]);

        // El atleta completa la sesión
        await request(app).post('/api/training/logs')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({ athleteId, workoutId, completed: true, exercises: [] });

        const after = await request(app).get(`/api/training/plans/${progressPlanId}/athletes-progress`)
            .set('Authorization', `Bearer ${coachToken}`);
        expect(after.status).toBe(200);
        expect(after.body.completedAthleteIds).toContain(athleteId);
    });

    it('getPlanAthletesProgress: prohibido para un coach ajeno al plan', async () => {
        const r = await request(app).get(`/api/training/plans/${planId}/athletes-progress`)
            .set('Authorization', `Bearer ${otherCoachToken}`);
        expect(r.status).toBe(403);
    });

    it('getPlanAthletesProgress: 404 para un plan inexistente', async () => {
        const r = await request(app).get(`/api/training/plans/${new mongoose.Types.ObjectId()}/athletes-progress`)
            .set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(404);
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
