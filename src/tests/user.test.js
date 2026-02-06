import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';

describe('User Management API', () => {

    beforeAll(async () => {
        const mongoUri = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/entrenamiento_test';

        try {
            if (mongoose.connection.readyState === 0) {
                // Forzamos family: 4 para evitar problemas con IPv6 en algunos entornos Linux
                await mongoose.connect(mongoUri, {
                    serverSelectionTimeoutMS: 5000,
                    family: 4
                });
            }
            await User.deleteMany({});
        } catch (error) {
            throw error;
        }
    }, 35000);

    afterAll(async () => {
        await mongoose.connection.close();
    }, 30000);

    let userId;

    describe('POST /api/users/register', () => {
        it('Debería registrar un nuevo usuario con éxito', async () => {
            const userData = {
                name: 'Diego Test',
                email: 'diego@test.com',
                password: 'password123',
                role: 'coach'
            };

            const res = await request(app)
                .post('/api/users/register')
                .send(userData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe(userData.email);
            userId = res.body.user.id;
        });

        it('No debería permitir registrar un usuario con el mismo email', async () => {
            const userData = {
                name: 'Otro Test',
                email: 'diego@test.com',
                password: 'password123'
            };

            const res = await request(app)
                .post('/api/users/register')
                .send(userData);

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toBe('El usuario ya existe');
        });
    });

    describe('GET /api/users/profile/:id', () => {
        it('Debería obtener el perfil de un usuario existente', async () => {
            const res = await request(app).get(`/api/users/profile/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.email).toBe('diego@test.com');
            expect(res.body).not.toHaveProperty('password');
        });

        it('Debería devolver 404 para un usuario inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).get(`/api/users/profile/${fakeId}`);

            expect(res.statusCode).toEqual(404);
        });
    });

    describe('PUT /api/users/profile/:id', () => {
        it('Debería actualizar el nombre de un usuario', async () => {
            const res = await request(app)
                .put(`/api/users/profile/${userId}`)
                .send({ name: 'Diego Actualizado' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.user.name).toBe('Diego Actualizado');
        });

        it('Debería devolver 404 al intentar actualizar un usuario inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/users/profile/${fakeId}`)
                .send({ name: 'Fake' });

            expect(res.statusCode).toEqual(404);
        });
    });

    describe('DELETE /api/users/profile/:id', () => {
        it('Debería eliminar un usuario existente', async () => {
            const res = await request(app).delete(`/api/users/profile/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toBe('Usuario eliminado con éxito');

            // Verificar que ya no existe
            const checkRes = await request(app).get(`/api/users/profile/${userId}`);
            expect(checkRes.statusCode).toEqual(404);
        });

        it('Debería devolver 404 al intentar eliminar un usuario inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).delete(`/api/users/profile/${fakeId}`);

            expect(res.statusCode).toEqual(404);
        });
    });
});
