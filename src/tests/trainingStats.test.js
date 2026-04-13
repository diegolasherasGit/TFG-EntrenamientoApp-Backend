import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import TrainingStats from '../models/TrainingStats.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import Workout from '../models/templates/Workout.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Training Stats API', () => {
    let userId;
    let workoutId;
    let authCookie;
    let mongoServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(mongoUri);
        }
        await User.deleteMany({});
        await TrainingStats.deleteMany({});
        await WorkoutLog.deleteMany({});
        await Workout.deleteMany({});

        const user = await new User({
            name: 'Stats Tester',
            email: 'stats@test.com',
            password: 'password123',
            role: 'athlete'
        }).save();
        userId = user._id.toString();

        const loginRes = await request(app).post('/api/users/login').send({ email: 'stats@test.com', password: 'password123' });
        authCookie = loginRes.headers['set-cookie'];

        const workout = await new Workout({
            name: 'Dummy Workout',
            plan: new mongoose.Types.ObjectId(),
            date: new Date()
        }).save();
        workoutId = workout._id;

    }, 40000);

    afterAll(async () => {
        await mongoose.connection.close();
        if (mongoServer) {
            await mongoServer.stop();
        }
    });

    describe('Training Stats Lifecycle', () => {
        it('Debería crear estadísticas iniciales para un usuario', async () => {
            const res = await request(app).post('/api/training/stats').set('Cookie', authCookie).send({ userId });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('user', userId);
        });

        it('Debería devolver 400 si el usuario ya tiene estadísticas', async () => {
            const res = await request(app).post('/api/training/stats').set('Cookie', authCookie).send({ userId });
            expect(res.statusCode).toEqual(400);
        });

        it('Debería obtener las estadísticas del usuario', async () => {
            const res = await request(app).get(`/api/training/stats/user/${userId}`).set('Cookie', authCookie);
            expect(res.statusCode).toEqual(200);
        });

        it('Debería devolver 404 al obtener estadísticas inexistentes', async () => {
            const res = await request(app).get(`/api/training/stats/user/${new mongoose.Types.ObjectId()}`).set('Cookie', authCookie);
            expect(res.statusCode).toEqual(404);
        });

        it('Debería actualizar las estadísticas (Agregar un PR)', async () => {
            const updateData = { totalWorkouts: 5, bestLifts: [{ exerciseName: 'Deadlift', value: '150kg', date: new Date().toISOString() }] };
            const res = await request(app).put(`/api/training/stats/user/${userId}`).set('Cookie', authCookie).send(updateData);
            expect(res.statusCode).toEqual(200);
            expect(res.body.totalWorkouts).toBe(5);
        });

        it('Debería actualizar reemplazando todo el array de Lifts', async () => {
            const updateData = { bestLifts: [ { exerciseName: 'Deadlift', value: '150kg' }, { exerciseName: 'Squat', value: '120kg' } ] };
            const res = await request(app).put(`/api/training/stats/user/${userId}`).set('Cookie', authCookie).send(updateData);
            expect(res.statusCode).toEqual(200);
            expect(res.body.bestLifts).toHaveLength(2);
        });

        it('Debería devolver 404 intentar actualizar algo borrado', async () => {
            const res = await request(app).put(`/api/training/stats/user/${new mongoose.Types.ObjectId()}`).set('Cookie', authCookie).send({ totalWorkouts: 10 });
            expect(res.statusCode).toEqual(404);
        });

        it('Debería realizar soft delete de las estadísticas', async () => {
            const res = await request(app).delete(`/api/training/stats/user/${userId}`).set('Cookie', authCookie);
            expect(res.statusCode).toEqual(200);
            expect(res.body.stats.isActive).toBe(false);

            const getRes = await request(app).get(`/api/training/stats/user/${userId}`).set('Cookie', authCookie);
            expect(getRes.statusCode).toEqual(404);
        });

        it('Debería devolver 404 en subrutina de fallo borrado', async () => {
            const res = await request(app).delete(`/api/training/stats/user/${new mongoose.Types.ObjectId()}`).set('Cookie', authCookie);
            expect(res.statusCode).toEqual(404);
        });
    });

    describe('Progress Visualization', () => {
        it('Debería obtener el historial de progreso de un ejercicio', async () => {
            await new WorkoutLog({ athlete: userId, workout: workoutId, date: new Date('2023-01-01'), exercises: [{ name: 'Squat', load: '100kg', sets: 3, reps: 5 }] }).save();
            await new WorkoutLog({ athlete: userId, workout: workoutId, date: new Date('2023-02-01'), exercises: [{ name: 'Squat', load: '110kg', sets: 3, reps: 5 }] }).save();

            const res = await request(app).get(`/api/training/stats/progress/${userId}`).set('Cookie', authCookie).query({ exercise: 'Squat' });
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveLength(2);
        });

        it('Debería devolver 400 si falta el parámetro exercise', async () => {
            const res = await request(app).get(`/api/training/stats/progress/${userId}`).set('Cookie', authCookie);
            expect(res.statusCode).toEqual(400);
        });

        it('Debería devolver un array vacío si no hay correlativos', async () => {
            const res = await request(app).get(`/api/training/stats/progress/${userId}`).set('Cookie', authCookie).query({ exercise: 'NonExistent' });
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveLength(0);
        });
    });
});
