import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import TrainingStats from '../../models/TrainingStats.js';
import TrainingPlan from '../../models/templates/TrainingPlan.js';
import Workout from '../../models/templates/Workout.js';
import WorkoutLog from '../../models/logs/WorkoutLog.js';
import User from '../../models/User.js';

describe('trainingStatsController', () => {
    let app, adminToken, coachToken, athleteToken, athleteId, planId, workoutId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_stats_ctrl');
        ({ app, adminToken, coachToken, athleteToken, athleteId, planId, workoutId } = env);
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
    it('getExerciseProgress: coach NO inscrito con el atleta -> 403', async () => {
        const r = await request(app).get(`/api/training/stats/progress/${athleteId}?exercise=Squat`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(403);
    });
    it('getExerciseProgress: coach inscrito ve el progreso de su atleta, no el de planes de otro coach', async () => {
        await TrainingPlan.findByIdAndUpdate(planId, { $addToSet: { athletes: athleteId } });
        await WorkoutLog.create({
            workout: workoutId,
            athlete: athleteId,
            completed: true,
            exercises: [{ name: 'Squat', sets: 3, reps: 10, load: '80kg', completed: true }],
        });

        const otherCoach = await User.create({ name: 'Other Coach', email: 'othercoach-stats@test.com', password: 'Password1', role: 'coach', isVerified: true });
        const otherPlan = await TrainingPlan.create({ name: 'OtherCoachPlan', coach: otherCoach._id, athletes: [athleteId], startDate: new Date(), endDate: new Date() });
        const otherWorkout = await Workout.create({ name: 'OtherWorkout', plan: otherPlan._id, coach: otherCoach._id, date: new Date() });
        await WorkoutLog.create({
            workout: otherWorkout._id,
            athlete: athleteId,
            completed: true,
            exercises: [{ name: 'Squat', sets: 5, reps: 5, load: '999kg', completed: true }],
        });

        const r = await request(app).get(`/api/training/stats/progress/${athleteId}?exercise=Squat`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
        expect(r.body.some((p) => p.value === '80kg')).toBe(true);
        expect(r.body.some((p) => p.value === '999kg')).toBe(false);
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

    it('getDashboardStats: coach cuenta las programadas por escalador, no por sesión', async () => {
        const coach = await User.create({ name: 'Team Coach', email: 'teamcoach-stats@test.com', password: 'Password1', role: 'coach', isVerified: true });
        const a1 = await User.create({ name: 'Team A1', email: 'team-a1@test.com', password: 'Password1', role: 'athlete', isVerified: true, membership: { status: 'active' } });
        const a2 = await User.create({ name: 'Team A2', email: 'team-a2@test.com', password: 'Password1', role: 'athlete', isVerified: true, membership: { status: 'active' } });
        const login = await request(app).post('/api/users/login').send({ email: 'teamcoach-stats@test.com', password: 'Password1' });

        // Plan con dos escaladores y dos sesiones esta semana: 4 entrenamientos esperados
        const grupo = await TrainingPlan.create({ name: 'Grupo', coach: coach._id, athletes: [a1._id, a2._id], startDate: new Date(), endDate: new Date() });
        const s1 = await Workout.create({ name: 'S1', plan: grupo._id, date: new Date() });
        await Workout.create({ name: 'S2', plan: grupo._id, date: new Date() });
        // Plan sin nadie inscrito: su sesión no la tiene que hacer nadie
        const vacio = await TrainingPlan.create({ name: 'Vacio', coach: coach._id, athletes: [], startDate: new Date(), endDate: new Date() });
        await Workout.create({ name: 'S3', plan: vacio._id, date: new Date() });

        await WorkoutLog.create({ workout: s1._id, athlete: a1._id, completed: true, date: new Date() });

        const r = await request(app).get('/api/training/stats/dashboard').set('Authorization', `Bearer ${login.body.token}`);
        expect(r.status).toBe(200);
        const semana = r.body.charts.weeklyTeamActivity.at(-1);
        expect(semana).toMatchObject({ completed: 1, scheduled: 4 });
        expect(r.body.summary.teamWeeklyAdherence).toBe(25);
        expect(r.body.summary.pendingSessionsThisWeek).toBe(3);
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
