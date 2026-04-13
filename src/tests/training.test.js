import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import Workout from '../models/templates/Workout.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Training Module API', () => {
    let coachId, athlete1Id, athlete2Id;
    let planId, workoutId;
    let coachCookie, athlete1Cookie;
    let mongoServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(mongoUri);
        }
        await User.deleteMany({});
        await TrainingPlan.deleteMany({});
        await Workout.deleteMany({});
        await WorkoutLog.deleteMany({});

        // Crear usuarios
        const coach = await new User({ name: 'Coach Test', email: 'coach@test.com', password: 'password123', role: 'coach' }).save();
        coachId = coach._id.toString();

        const athlete1 = await new User({ name: 'Athlete 1', email: 'athlete1@test.com', password: 'password123', role: 'athlete' }).save();
        athlete1Id = athlete1._id.toString();

        const athlete2 = await new User({ name: 'Athlete 2', email: 'athlete2@test.com', password: 'password123', role: 'athlete' }).save();
        athlete2Id = athlete2._id.toString();

        // Iniciar sesión y capturar cookies para sortear el middleware 'protect'
        const resCoach = await request(app).post('/api/users/login').send({ email: 'coach@test.com', password: 'password123' });
        coachCookie = resCoach.headers['set-cookie'];

        const resAth1 = await request(app).post('/api/users/login').send({ email: 'athlete1@test.com', password: 'password123' });
        athlete1Cookie = resAth1.headers['set-cookie'];

    }, 40000);

    afterAll(async () => {
        await mongoose.connection.close();
        if (mongoServer) {
            await mongoServer.stop();
        }
    }, 30000);

    describe('Training Plans', () => {
        it('Debería crear un nuevo plan de entrenamiento con éxito', async () => {
            const planData = { name: 'Plan de Fuerza Verano', description: 'Un plan enfocado en fuerza máxima', coachId: coachId, athleteIds: [athlete1Id, athlete2Id], startDate: '2026-06-01', endDate: '2026-08-31' };
            const res = await request(app).post('/api/training/plans').set('Cookie', coachCookie).send(planData);
            expect(res.statusCode).toEqual(201);
            expect(res.body.plan.name).toBe(planData.name);
            planId = res.body.plan._id;
        });

        it('Debería obtener los planes asignados a un atleta', async () => {
            const res = await request(app).get(`/api/training/plans/athlete/${athlete1Id}`).set('Cookie', athlete1Cookie);
            expect(res.statusCode).toEqual(200);
            expect(res.body.plans[0].name).toBe('Plan de Fuerza Verano');
            expect(res.body.plans.length).toBeGreaterThan(0);
        });

        it('Debería obtener los planes creados por un entrenador', async () => {
            const res = await request(app).get(`/api/training/plans/coach/${coachId}`).set('Cookie', coachCookie);
            expect(res.statusCode).toEqual(200);
            expect(res.body.plans[0].name).toBe('Plan de Fuerza Verano');
        });

        it('Debería actualizar un plan de entrenamiento con éxito', async () => {
            const res = await request(app).put(`/api/training/plans/${planId}`).set('Cookie', coachCookie).send({ name: 'Plan de Fuerza Modificado' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.plan.name).toBe('Plan de Fuerza Modificado');
        });

        it('Debería devolver 404 al intentar actualizar plan inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).put(`/api/training/plans/${fakeId}`).set('Cookie', coachCookie).send({ name: 'Fake' });
            expect(res.statusCode).toEqual(404);
        });

        it('Debería devolver 404 al intentar borrar un plan inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).delete(`/api/training/plans/${fakeId}`).set('Cookie', coachCookie);
            expect(res.statusCode).toEqual(404);
        });
    });

    describe('Workouts (Plantillas)', () => {
        it('Debería crear una sesión de entrenamiento para un plan', async () => {
            const workoutData = { planId: planId, date: '2026-06-05', name: 'Sesión 1', exercises: [{ name: 'Dominadas', type: 'strength', parameters: { sets: 5, reps: 5 } }] };
            const res = await request(app).post('/api/training/workouts').set('Cookie', coachCookie).send(workoutData);
            expect(res.statusCode).toEqual(201);
            workoutId = res.body.workout._id;
        });

        it('Debería obtener las sesiones de un plan', async () => {
            const res = await request(app).get(`/api/training/workouts/plan/${planId}`).set('Cookie', athlete1Cookie);
            expect(res.statusCode).toEqual(200);
            expect(res.body.workouts[0].name).toBe('Sesión 1');
        });

        it('Debería actualizar una sesión', async () => {
            const res = await request(app).put(`/api/training/workouts/${workoutId}`).set('Cookie', coachCookie).send({ name: 'Sesión Avanzada' });
            expect(res.statusCode).toEqual(200);
        });

        it('Debería devolver 404 al actualizar sesión inexistente', async () => {
            const res = await request(app).put(`/api/training/workouts/${new mongoose.Types.ObjectId()}`).set('Cookie', coachCookie).send({ name: 'Fake' });
            expect(res.statusCode).toEqual(404);
        });
    });

    describe('Workout Logs (Resultados)', () => {
        it('Debería registrar el resultado de un entrenamiento', async () => {
            const logData = { workoutId: workoutId, athleteId: athlete1Id, exercises: [{ name: 'Dominadas', completed: true, notes: 'Ok' }], completed: true, notes: 'Bueno', date: '2026-06-05' };
            const res = await request(app).post('/api/training/logs').set('Cookie', athlete1Cookie).send(logData);
            expect(res.statusCode).toEqual(201);
        });

        it('Debería obtener el historial de logs de un atleta', async () => {
            const res = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`).set('Cookie', athlete1Cookie);
            expect(res.statusCode).toEqual(200);
            expect(res.body.logs.length).toBeGreaterThan(0);
        });

        it('Debería actualizar un resultado', async () => {
            const listRes = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`).set('Cookie', athlete1Cookie);
            const logId = listRes.body.logs[0]._id;
            const res = await request(app).put(`/api/training/logs/${logId}`).set('Cookie', athlete1Cookie).send({ notes: 'Excelente' });
            expect(res.statusCode).toEqual(200);
        });
    });

    describe('Soft Delete Verification', () => {
        let logId;
        it('Debería obtener un logID válido', async () => {
            const res = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`).set('Cookie', athlete1Cookie);
            logId = res.body.logs[0]._id;
            expect(logId).toBeDefined();
        });

        it('Debería borrar un log lógicamente', async () => {
            const res = await request(app).delete(`/api/training/logs/${logId}`).set('Cookie', athlete1Cookie);
            expect(res.statusCode).toEqual(200);
            expect(res.body.log.isActive).toBe(false);

            const listRes = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`).set('Cookie', athlete1Cookie);
            expect(listRes.body.logs.find(l => l._id === logId)).toBeUndefined();
        });

        it('Debería borrar una sesión lógicamente', async () => {
            const res = await request(app).delete(`/api/training/workouts/${workoutId}`).set('Cookie', coachCookie);
            expect(res.statusCode).toEqual(200);

            const listRes = await request(app).get(`/api/training/workouts/plan/${planId}`).set('Cookie', coachCookie);
            expect(listRes.body.workouts.find(w => w._id === workoutId)).toBeUndefined();
        });

        it('Debería borrar un plan lógicamente', async () => {
            const res = await request(app).delete(`/api/training/plans/${planId}`).set('Cookie', coachCookie);
            expect(res.statusCode).toEqual(200);

            const listRes = await request(app).get(`/api/training/plans/coach/${coachId}`).set('Cookie', coachCookie);
            expect(listRes.body.plans.find(p => p._id === planId)).toBeUndefined();
        });
    });
});
