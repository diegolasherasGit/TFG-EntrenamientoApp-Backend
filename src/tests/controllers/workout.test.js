import request from 'supertest';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

describe('workoutController', () => {
    let app, adminToken, coachToken, athleteToken, planId;
    let workoutId, otherCoachToken;

    beforeAll(async () => {
        const env = await setupTestEnv('test_workout_ctrl');
        ({ app, adminToken, coachToken, athleteToken, planId } = env);

        // Crear un segundo coach para pruebas de permisos
        await User.create({ name: 'Coach 2', email: 'coach2@test.com', password: 'Password1', role: 'coach', isVerified: true });
        const res = await request(app).post('/api/users/login').send({ email: 'coach2@test.com', password: 'Password1' });
        otherCoachToken = res.body.token;
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('createWorkout: success by coach', async () => {
        const r = await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ planId, date: new Date(), name: 'Workout A', estimatedDuration: 45, exercises: [{ name: 'Squat' }] });
        expect(r.status).toBe(201);
        expect(r.body.workout.estimatedDuration).toBe(45);
        workoutId = r.body.workout._id;
    });

    it('createWorkout: success with time field', async () => {
        const r = await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ planId, date: new Date(), time: '10:30', name: 'Workout with Time', estimatedDuration: 45, exercises: [{ name: 'Squat' }] });
        expect(r.status).toBe(201);
        expect(r.body.workout.time).toBe('10:30');
    });
    it('createWorkout: 400 fecha fuera del rango del plan', async () => {
        // El plan de test dura solo "hoy" (startDate == endDate == hoy)
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const r = await request(app).post('/api/training/workouts')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ planId, date: tomorrow, name: 'Fuera de rango', estimatedDuration: 45 });
        expect(r.status).toBe(400);
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
            .set('Authorization', `Bearer ${coachToken}`).send({ name: 'Updated Workout', estimatedDuration: 55 });
        expect(r.status).toBe(200);
        expect(r.body.workout.estimatedDuration).toBe(55);
    });

    it('updateWorkout: success with time field', async () => {
        const r = await request(app).put(`/api/training/workouts/${workoutId}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ name: 'Updated Workout', time: '14:45' });
        expect(r.status).toBe(200);
        expect(r.body.workout.time).toBe('14:45');
    });
    it('updateWorkout: 400 nueva fecha fuera del rango del plan', async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const r = await request(app).put(`/api/training/workouts/${workoutId}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ date: tomorrow });
        expect(r.status).toBe(400);
    });
    it('updateWorkout: separate coach → 403', async () => {
        const r = await request(app).put(`/api/training/workouts/${workoutId}`)
            .set('Authorization', `Bearer ${otherCoachToken}`).send({ name: 'Hacked' });
        expect(r.status).toBe(403);
    });
    it('updateWorkout: 404 unknown', async () => {
        const r = await request(app).put(`/api/training/workouts/${new mongoose.Types.ObjectId()}`)
            .set('Authorization', `Bearer ${coachToken}`).send({ name: 'X' });
        expect(r.status).toBe(404);
    });

    it('duplicateWorkout: success (misma fecha, dentro de rango)', async () => {
        const r = await request(app).post(`/api/training/workouts/${workoutId}/duplicate`)
            .set('Authorization', `Bearer ${coachToken}`).send({});
        expect(r.status).toBe(201);
    });
    it('duplicateWorkout: 400 fecha fuera del rango del plan', async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const r = await request(app).post(`/api/training/workouts/${workoutId}/duplicate`)
            .set('Authorization', `Bearer ${coachToken}`).send({ date: tomorrow });
        expect(r.status).toBe(400);
    });

    // --- Apuntarse a una sesión (attendWorkout / unattendWorkout) ---
    it('attend: atleta no inscrito en el plan → 403', async () => {
        const r = await request(app).post(`/api/training/workouts/${workoutId}/attend`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(403);
    });
    it('attend: tras inscribirse en el plan, se apunta → 200', async () => {
        await request(app).post(`/api/training/plans/${planId}/enroll`)
            .set('Authorization', `Bearer ${athleteToken}`);
        const r = await request(app).post(`/api/training/workouts/${workoutId}/attend`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.attendees.length).toBe(1);
    });
    it('attend: el coach recibe una notificación del atleta apuntado', async () => {
        const r = await request(app).get('/api/notifications')
            .set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
        const notif = r.body.data.find(n => n.title === 'Nuevo atleta apuntado');
        expect(notif).toBeDefined();
        expect(notif.message).toContain('Athlete');
    });
    it('attend: ya apuntado → 400', async () => {
        const r = await request(app).post(`/api/training/workouts/${workoutId}/attend`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(400);
    });
    it('getWorkoutById: el coach ve al atleta apuntado (populado con nombre)', async () => {
        const r = await request(app).get(`/api/training/workouts/${workoutId}`)
            .set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
        expect(r.body.attendees.length).toBe(1);
        expect(r.body.attendees[0].name).toBe('Athlete');
    });
    it('unattend: se desapunta → 200', async () => {
        const r = await request(app).delete(`/api/training/workouts/${workoutId}/attend`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(200);
        expect(r.body.attendees.length).toBe(0);
    });
    it('unattend: no estaba apuntado → 400', async () => {
        const r = await request(app).delete(`/api/training/workouts/${workoutId}/attend`)
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(400);
    });

    it('deleteWorkout: 404 unknown', async () => {
        const r = await request(app).delete(`/api/training/workouts/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(404);
    });
    it('deleteWorkout: separate coach → 403', async () => {
        const r = await request(app).delete(`/api/training/workouts/${workoutId}`).set('Authorization', `Bearer ${otherCoachToken}`);
        expect(r.status).toBe(403);
    });
    it('deleteWorkout: success', async () => {
        const r = await request(app).delete(`/api/training/workouts/${workoutId}`).set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(200);
    });
});
