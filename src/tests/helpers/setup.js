import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app.js';
import User from '../../models/User.js';
import TrainingPlan from '../../models/templates/TrainingPlan.js';
import Workout from '../../models/templates/Workout.js';
import TrainingStats from '../../models/TrainingStats.js';
import WorkoutLog from '../../models/logs/WorkoutLog.js';

import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

/**
 * Shared test environment setup.
 * Connects to a shared test DB and cleans all collections before setting up
 * the canonical users, plan, and workout that each controller test needs.
 */
export async function setupTestEnv() {
    if (!mongoServer) {
        mongoServer = await MongoMemoryServer.create();
    }
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
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
    const athlete = await User.create({ name: 'Athlete', email: 'athlete@test.com', password: 'Password1', role: 'athlete', isVerified: true });

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
        await mongoose.connection.close();
    }
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
}
