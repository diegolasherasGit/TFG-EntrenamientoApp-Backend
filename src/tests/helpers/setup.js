import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app.js';
import User from '../../models/User.js';
import TrainingPlan from '../../models/templates/TrainingPlan.js';
import Workout from '../../models/templates/Workout.js';
import TrainingStats from '../../models/TrainingStats.js';
import WorkoutLog from '../../models/logs/WorkoutLog.js';

// MongoDB SIEMPRE corre en Docker, también en las pruebas: nos conectamos al
// contenedor vía MONGO_URI. Forzamos una base de datos de pruebas dedicada
// (MONGO_TEST_DB) para no tocar nunca los datos de desarrollo, sea cual sea la
// base que indique la URI.
const TEST_DB = process.env.MONGO_TEST_DB || 'test_db';

/**
 * Shared test environment setup.
 * Connects to the Dockerized test DB and cleans all collections before setting
 * up the canonical users, plan, and workout that each controller test needs.
 */
export async function setupTestEnv() {
    if (mongoose.connection.readyState === 0) {
        if (!process.env.MONGO_URI) {
            throw new Error(
                'MONGO_URI no está definida. Las pruebas requieren el MongoDB de Docker (p. ej. mongodb://mongo:27017).'
            );
        }
        await mongoose.connect(process.env.MONGO_URI, { dbName: TEST_DB });
    }

    // Clean everything
    await Promise.all([
        User.deleteMany({}),
        TrainingPlan.deleteMany({}),
        Workout.deleteMany({}),
        TrainingStats.deleteMany({}),
        WorkoutLog.deleteMany({}),
    ]);

    // Create base users
    const admin = await User.create({ name: 'Admin', email: 'admin@test.com', password: 'Password1', role: 'admin', isVerified: true });
    const coach = await User.create({ name: 'Coach', email: 'coach@test.com', password: 'Password1', role: 'coach', isVerified: true });
    // El atleta de pruebas tiene abono activo para que las rutas de contenido
    // (gated por requireActiveMembership) sigan accesibles en los tests.
    const athlete = await User.create({ name: 'Athlete', email: 'athlete@test.com', password: 'Password1', role: 'athlete', isVerified: true, membership: { status: 'active' } });

    const resAdmin = await request(app).post('/api/users/login').send({ email: 'admin@test.com', password: 'Password1' });
    const resCoach = await request(app).post('/api/users/login').send({ email: 'coach@test.com', password: 'Password1' });
    const resAth = await request(app).post('/api/users/login').send({ email: 'athlete@test.com', password: 'Password1' });

    // Create a plan and workout for tests that need them
    const plan = await TrainingPlan.create({ name: 'TestPlan', coach: coach._id, startDate: new Date(), endDate: new Date() });
    const workout = await Workout.create({ name: 'TestWorkout', plan: plan._id, coach: coach._id, date: new Date() });

    return {
        app,
        adminId: admin._id.toString(),
        coachId: coach._id.toString(),
        athleteId: athlete._id.toString(),
        adminToken: resAdmin.body.token,
        coachToken: resCoach.body.token,
        athleteToken: resAth.body.token,
        planId: plan._id.toString(),
        workoutId: workout._id.toString(),
    };
}

export async function teardownTestEnv() {
    if (mongoose.connection.readyState !== 0) {
        // Dejamos la base de pruebas limpia (es dedicada, nunca la de desarrollo).
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
}
