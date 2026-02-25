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

        // Crear un workout dummy para los logs
        const workout = await new Workout({
            name: 'Dummy Workout',
            plan: new mongoose.Types.ObjectId(), // Dummy plan ID
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
            const res = await request(app)
                .post('/api/training/stats')
                .send({ userId });

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('user', userId);
            expect(res.body.totalWorkouts).toBe(0);
            expect(res.body.bestLifts).toHaveLength(0);
        });

        it('Debería devolver 400 si el usuario ya tiene estadísticas', async () => {
            const res = await request(app)
                .post('/api/training/stats')
                .send({ userId });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toBe('El usuario ya tiene estadísticas registradas');
        });

        it('Debería obtener las estadísticas del usuario', async () => {
            const res = await request(app).get(`/api/training/stats/user/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('user', userId);
        });

        it('Debería devolver 404 al obtener estadísticas de un usuario inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).get(`/api/training/stats/user/${fakeId}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Estadísticas no encontradas para este usuario');
        });

        it('Debería actualizar las estadísticas (Agregar un PR)', async () => {
            const updateData = {
                totalWorkouts: 5,
                bestLifts: [
                    {
                        exerciseName: 'Deadlift',
                        value: '150kg',
                        date: new Date().toISOString()
                    }
                ]
            };

            const res = await request(app)
                .put(`/api/training/stats/user/${userId}`)
                .send(updateData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.totalWorkouts).toBe(5);
            expect(res.body.bestLifts).toHaveLength(1);
            expect(res.body.bestLifts[0].exerciseName).toBe('Deadlift');
            expect(res.body.bestLifts[0].value).toBe('150kg');
        });

        it('Debería actualizar las estadísticas (Agregar otro PR y mantener el anterior si se envía todo)', async () => {
            // Nota: El PUT actual reemplaza el array bestLifts si se envía.
            // Para agregar uno nuevo sin borrar el anterior, el frontend debe enviar el array completo o el backend debe soportar $push (actualmente es reemplazo simple en controlador).
            // Probaremos el reemplazo/actualización del array completo.
            const updateData = {
                bestLifts: [
                    {
                        exerciseName: 'Deadlift',
                        value: '150kg'
                    },
                    {
                        exerciseName: 'Squat',
                        value: '120kg'
                    }
                ]
            };

            const res = await request(app)
                .put(`/api/training/stats/user/${userId}`)
                .send(updateData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.bestLifts).toHaveLength(2);
        });

        it('Debería devolver 404 al intentar actualizar estadísticas inexistentes', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/training/stats/user/${fakeId}`)
                .send({ totalWorkouts: 10 });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Estadísticas no encontradas');
        });

        it('Debería realizar soft delete de las estadísticas', async () => {
            const res = await request(app).delete(`/api/training/stats/user/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.stats.isActive).toBe(false);

            // Verificar que aún se pueden obtener pero están inactivas
            const getRes = await request(app).get(`/api/training/stats/user/${userId}`);
            expect(getRes.statusCode).toEqual(200);
            expect(getRes.body.isActive).toBe(false);
        });

        it('Debería devolver 404 al intentar eliminar estadísticas inexistentes', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).delete(`/api/training/stats/user/${fakeId}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Estadísticas no encontradas');
        });
    });

    describe('Progress Visualization', () => {
        it('Debería obtener el historial de progreso de un ejercicio', async () => {
            // Crear logs simulados
            await new WorkoutLog({
                athlete: userId,
                workout: workoutId,
                date: new Date('2023-01-01'),
                exercises: [{ name: 'Squat', load: '100kg', sets: 3, reps: 5 }]
            }).save();

            await new WorkoutLog({
                athlete: userId,
                workout: workoutId,
                date: new Date('2023-02-01'),
                exercises: [{ name: 'Squat', load: '110kg', sets: 3, reps: 5 }]
            }).save();

            const res = await request(app)
                .get(`/api/training/stats/progress/${userId}`)
                .query({ exercise: 'Squat' });

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].value).toBe('100kg');
            expect(res.body[1].value).toBe('110kg');
        });

        it('Debería devolver 400 si no se proporciona el parámetro exercise', async () => {
            const res = await request(app).get(`/api/training/stats/progress/${userId}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toBe('Se requiere el parámetro "exercise"');
        });

        it('Debería devolver un array vacío si no hay logs que coincidan con el ejercicio', async () => {
            const res = await request(app)
                .get(`/api/training/stats/progress/${userId}`)
                .query({ exercise: 'NonExistentExercise' });

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(0);
        });
    });
});
