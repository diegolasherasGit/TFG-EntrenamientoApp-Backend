import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import TrainingPlan from './src/models/templates/TrainingPlan.js';
import Workout from './src/models/templates/Workout.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/entrenamiento_db';
// Reemplazar solo la parte del hostname que sigue a '//'
const localUri = MONGO_URI.replace('//@mongo', '//@localhost').replace('://mongo', '://localhost');

async function seed() {
    try {
        console.log(`Intentando conectar a: ${localUri}`);
        await mongoose.connect(localUri);
        console.log('Conectado a MongoDB...');

        // Limpiar datos previos para evitar duplicados en el seed
        await User.deleteMany({ email: { $in: ['admin@test.com', 'coach@test.com', 'atleta1@test.com', 'atleta2@test.com'] } });

        // 1. Crear Administrador
        const admin = await User.create({
            name: 'Admin Sistema',
            email: 'admin@test.com',
            password: 'Password123',
            role: 'admin'
        });
        console.log('✅ Admin creado');

        // 2. Crear Coach
        const coach = await User.create({
            name: 'Coach Javier',
            email: 'coach@test.com',
            password: 'password123',
            role: 'coach'
        });
        console.log('✅ Coach creado');

        // 3. Crear Atletas
        const atleta1 = await User.create({
            name: 'Diego Atleta',
            email: 'atleta1@test.com',
            password: 'password123',
            role: 'athlete'
        });
        const atleta2 = await User.create({
            name: 'Ana Escaladora',
            email: 'atleta2@test.com',
            password: 'password123',
            role: 'athlete'
        });
        console.log('✅ Atletas creados');

        // 4. Crear un Plan de Entrenamiento
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(today.getMonth() + 1);

        const plan = await TrainingPlan.create({
            name: 'Plan de Fuerza y Bloque',
            description: 'Enfocado en pasos explosivos y fuerza de dedos.',
            coach: coach._id,
            athletes: [atleta1._id, atleta2._id],
            startDate: today,
            endDate: nextMonth
        });
        console.log('✅ Plan de entrenamiento creado');

        // 5. Crear Sesiones (Workouts)
        const date1 = new Date(); // Hoy
        const date2 = new Date();
        date2.setDate(today.getDate() + 2); // Pasado mañana
        const date3 = new Date();
        date3.setDate(today.getDate() - 1); // Ayer (Historial)

        await Workout.create([
            {
                plan: plan._id,
                name: 'Bloque Explosivo',
                date: date1,
                exercises: [
                    { name: 'Dominadas Lastradas', sets: 4, reps: 5, load: '10kg' },
                    { name: 'Campus Board', sets: 3, reps: 10, load: 'BW' }
                ]
            },
            {
                plan: plan._id,
                name: 'Fuerza Máxima Dedos',
                date: date2,
                exercises: [
                    { name: 'Hangboard - 15mm', sets: 5, reps: 1, load: '+5kg (10s)' },
                    { name: 'Bloque de Regletas', sets: 6, reps: 4, load: 'V6' }
                ]
            },
            {
                plan: plan._id,
                name: 'Acondicionamiento General',
                date: date3,
                exercises: [
                    { name: 'Core - Plancha', sets: 3, reps: 60, load: 'segundos' },
                    { name: 'Flexiones', sets: 3, reps: 15, load: 'BW' }
                ]
            }
        ]);
        console.log('✅ Sesiones de entrenamiento creadas');

        console.log('\n🚀 SEED COMPLETADO CON ÉXITO');
        console.log('------------------------------');
        console.log('Admin: admin@test.com / Password123');
        console.log('Coach: coach@test.com / password123');
        console.log('Atleta: atleta1@test.com / password123');
        console.log('------------------------------');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en el seed:', error);
        process.exit(1);
    }
}

seed();
