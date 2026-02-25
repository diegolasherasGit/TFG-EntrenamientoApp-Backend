import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import Workout from '../models/templates/Workout.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Training Module API', () => {
    let coachId;
    let athlete1Id;
    let athlete2Id;
    let planId;
    let workoutId;

    let mongoServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(mongoUri);
        }
        // Limpiar colecciones antes de empezar
        await User.deleteMany({});
        await TrainingPlan.deleteMany({});
        await Workout.deleteMany({});
        await WorkoutLog.deleteMany({});

        // Crear usuarios de prueba
        const coach = await new User({
            name: 'Coach Test',
            email: 'coach@test.com',
            password: 'password123',
            role: 'coach'
        }).save();
        coachId = coach._id.toString();

        const athlete1 = await new User({
            name: 'Athlete 1',
            email: 'athlete1@test.com',
            password: 'password123',
            role: 'athlete'
        }).save();
        athlete1Id = athlete1._id.toString();

        const athlete2 = await new User({
            name: 'Athlete 2',
            email: 'athlete2@test.com',
            password: 'password123',
            role: 'athlete'
        }).save();
        athlete2Id = athlete2._id.toString();
    }, 40000);

    afterAll(async () => {
        await mongoose.connection.close();
        if (mongoServer) {
            await mongoServer.stop();
        }
    }, 30000);

    describe('Training Plans', () => {
        it('Debería crear un nuevo plan de entrenamiento con éxito', async () => {
            const planData = {
                name: 'Plan de Fuerza Verano',
                description: 'Un plan enfocado en fuerza máxima',
                coachId: coachId,
                athleteIds: [athlete1Id, athlete2Id],
                startDate: '2026-06-01',
                endDate: '2026-08-31'
            };

            const res = await request(app)
                .post('/api/training/plans')
                .send(planData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('plan');
            expect(res.body.plan.name).toBe(planData.name);
            expect(res.body.plan.athletes).toContain(athlete1Id);
            expect(res.body.plan.athletes).toContain(athlete2Id);
            planId = res.body.plan._id;
        });

        it('Debería obtener los planes asignados a un atleta', async () => {
            const res = await request(app).get(`/api/training/plans/athlete/${athlete1Id}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('plans');
            expect(Array.isArray(res.body.plans)).toBe(true);
            expect(res.body.plans.length).toBeGreaterThan(0);
            expect(res.body.plans[0].name).toBe('Plan de Fuerza Verano');
            expect(res.body.total).toBeGreaterThan(0);
        });

        it('Debería obtener los planes creados por un entrenador', async () => {
            const res = await request(app).get(`/api/training/plans/coach/${coachId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('plans');
            expect(Array.isArray(res.body.plans)).toBe(true);
            expect(res.body.plans.length).toBeGreaterThan(0);
            expect(res.body.plans[0].name).toBe('Plan de Fuerza Verano');
        });

        it('Debería actualizar un plan de entrenamiento con éxito', async () => {
            const updateData = { name: 'Plan de Fuerza Verano Modificado' };
            const res = await request(app)
                .put(`/api/training/plans/${planId}`)
                .send(updateData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.plan.name).toBe('Plan de Fuerza Verano Modificado');
        });

        it('Debería devolver 404 al actualizar un plan inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/training/plans/${fakeId}`)
                .send({ name: 'Fake Plan' });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Plan no encontrado o archivado');
        });

        it('Debería devolver 404 al intentar borrar un plan inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/training/plans/${fakeId}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Plan no encontrado');
        });
    });

    describe('Workouts (Plantillas)', () => {
        it('Debería crear una sesión de entrenamiento para un plan', async () => {
            const workoutData = {
                planId: planId,
                date: '2026-06-05',
                name: 'Sesión de Bloque',
                exercises: [
                    {
                        name: 'Dominadas Peso',
                        type: 'strength',
                        parameters: { sets: 5, reps: 5, weight: 10 }
                    },
                    {
                        name: 'Bloque Progresivo',
                        type: 'climbing',
                        parameters: { duration: '60min', intensity: 'high' }
                    }
                ]
            };

            const res = await request(app)
                .post('/api/training/workouts')
                .send(workoutData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('workout');
            expect(res.body.workout.name).toBe(workoutData.name);
            expect(res.body.workout.plan).toBe(planId);
            workoutId = res.body.workout._id;
        });

        it('Debería obtener las sesiones de un plan', async () => {
            const res = await request(app).get(`/api/training/workouts/plan/${planId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('workouts');
            expect(Array.isArray(res.body.workouts)).toBe(true);
            expect(res.body.workouts.length).toBeGreaterThan(0);
            expect(res.body.workouts.length).toBeGreaterThan(0);
            expect(res.body.workouts[0].name).toBe('Sesión de Bloque');
        });

        it('Debería actualizar una sesión de entrenamiento', async () => {
            const updateData = { name: 'Sesión de Bloque Avanzado' };
            const res = await request(app)
                .put(`/api/training/workouts/${workoutId}`)
                .send(updateData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.workout.name).toBe('Sesión de Bloque Avanzado');
        });

        it('Debería devolver 404 al actualizar una sesión inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/training/workouts/${fakeId}`)
                .send({ name: 'Fake Workout' });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Sesión no encontrada');
        });

        it('Debería devolver 404 al enviar borrar una sesión inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/training/workouts/${fakeId}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Sesión no encontrada');
        });
    });

    describe('Workout Logs (Resultados)', () => {
        it('Debería registrar el resultado de un entrenamiento para un atleta', async () => {
            const logData = {
                workoutId: workoutId,
                athleteId: athlete1Id,
                exercises: [
                    {
                        name: 'Dominadas Peso',
                        completed: true,
                        notes: 'Costó la última serie'
                    }
                ],
                completed: true,
                notes: 'Buen entrenamiento general',
                date: '2026-06-05'
            };

            const res = await request(app)
                .post('/api/training/logs')
                .send(logData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('log');
            expect(res.body.log.athlete).toBe(athlete1Id);
            expect(res.body.log.workout).toBe(workoutId);
        });

        it('Debería obtener el historial de logs de un atleta', async () => {
            const res = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('logs');
            expect(Array.isArray(res.body.logs)).toBe(true);
            expect(res.body.logs.length).toBeGreaterThan(0);
            expect(res.body.logs.length).toBeGreaterThan(0);
            expect(res.body.logs[0].notes).toBe('Buen entrenamiento general');
        });

        it('Debería actualizar un resultado (log)', async () => {
            // we need the logId for this athlete
            const listRes = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`);
            const logId = listRes.body.logs[0]._id;

            const res = await request(app)
                .put(`/api/training/logs/${logId}`)
                .send({ notes: 'Excelente entrenamiento modificado' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.log.notes).toBe('Excelente entrenamiento modificado');
        });

        it('Debería devolver 404 al intentar actualizar un log inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/training/logs/${fakeId}`)
                .send({ notes: 'fake' });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Log no encontrado');
        });
    });

    describe('Soft Delete Verification', () => {
        let logId;

        it('Debería obtener el ID de un log para borrar', async () => {
            const res = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`);
            logId = res.body.logs[0]._id;
            expect(logId).toBeDefined();
        });

        it('Debería realizar soft delete de un log', async () => {
            const res = await request(app).delete(`/api/training/logs/${logId}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body.log.isActive).toBe(false);

            // Verificar que ya no aparece en la lista del atleta
            const listRes = await request(app).get(`/api/training/logs/athlete/${athlete1Id}`);
            const logFound = listRes.body.logs.find(l => l._id === logId);
            expect(logFound).toBeUndefined();
        });

        it('Debería realizar soft delete de una sesión (workout)', async () => {
            const res = await request(app).delete(`/api/training/workouts/${workoutId}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body.workout.isActive).toBe(false);

            // Verificar que ya no aparece en la lista del plan
            const listRes = await request(app).get(`/api/training/workouts/plan/${planId}`);
            const workoutFound = listRes.body.workouts.find(w => w._id === workoutId);
            expect(workoutFound).toBeUndefined();
        });

        it('Debería realizar soft delete de un plan y que no aparezca para el coach', async () => {
            const res = await request(app).delete(`/api/training/plans/${planId}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body.plan.isActive).toBe(false);

            // Verificar que ya no aparece en la lista del coach
            const listRes = await request(app).get(`/api/training/plans/coach/${coachId}`);
            const planFound = listRes.body.plans.find(p => p._id === planId);
            expect(planFound).toBeUndefined();
        });
    });
});
