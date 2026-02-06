import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';

describe('User Management API', () => {

    beforeAll(async () => {
        // Conectar a la base de datos para los tests
        const mongoUri = 'mongodb://127.0.0.1:27017/entrenamiento_test';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(mongoUri);
        }
        await User.deleteMany({});
    }, 30000);

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
});
