import '../config/db.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Modelos
import User from '../models/User.js';
import TrainingStats from '../models/TrainingStats.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import Workout from '../models/templates/Workout.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import softDeletePlugin from '../models/plugins/softDelete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// El seed se ejecuta dentro de Docker (compose / `... exec backend`), donde el
// host de Mongo es el servicio `mongo`.
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/entrenamiento_db';

const seedDatabase = async () => {
    try {
        console.log(`Conectando a MongoDB en: ${mongoUri}`);
        mongoose.plugin(softDeletePlugin);
        await mongoose.connect(mongoUri);
        console.log('Conectado a MongoDB para Seeding...');

        console.log('Limpiando la base de datos (esto borrará datos actuales en DEV)...');
        await Promise.all([
            User.deleteMany({}),
            TrainingStats.deleteMany({}),
            TrainingPlan.deleteMany({}),
            Workout.deleteMany({}),
            WorkoutLog.deleteMany({})
        ]);

        console.log('Creando Usuarios (Admin, 5 Coaches, 50 Atletas)...');

        // Contraseña común (La hasheamos manualmente para insertMany)
        const hashedPassword = await bcrypt.hash('password123', 12);

        // Admin (usamos Create para que dispare el pre-save hook con texto plano)
        const adminData = {
            name: 'Test Admin',
            email: 'admin@test.com',
            password: 'password123',
            role: 'admin',
            isVerified: true,
            isActive: true
        };
        await User.create(adminData);

        // Coaches
        const coachesData = [];
        for (let i = 1; i <= 5; i++) {
            coachesData.push({
                name: `Coach ${i}`,
                email: `coach${i}@test.com`,
                password: hashedPassword,
                role: 'coach',
                isVerified: true,
                isActive: true
            });
        }
        const coaches = await User.insertMany(coachesData);

        // Atletas
        const athletesData = [];
        for (let i = 1; i <= 50; i++) {
            athletesData.push({
                name: `Atleta ${i}`,
                email: `atleta${i}@test.com`,
                password: hashedPassword,
                role: 'athlete',
                isVerified: true,
                isActive: true
            });
        }
        const athletes = await User.insertMany(athletesData);

        // Estadísticas para cada atleta
        const statsData = athletes.map(athlete => ({
            user: athlete._id,
            totalWorkouts: Math.floor(Math.random() * 50),
            totalExercises: Math.floor(Math.random() * 500),
            lastWorkoutDate: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
        }));
        await TrainingStats.insertMany(statsData);
        console.log(`Creados: 1 Admin, ${coaches.length} Coaches, ${athletes.length} Atletas con sus Stats.`);

        console.log('Generando Planes de Entrenamiento...');
        const plans = [];
        const workoutsPromises = [];
        // Cada coach crea 2 planes
        for (const coach of coaches) {
            for (let p = 1; p <= 2; p++) {
                // Asignamos aleatoriamente de 5 a 10 atletas al coach para este plan
                const assignedAthletes = athletes
                    .sort(() => 0.5 - Math.random())
                    .slice(0, Math.floor(Math.random() * 6) + 5);

                const plan = new TrainingPlan({
                    name: `Plan ${p} de fuerza avanzado por ${coach.name.split(' ')[0]}`,
                    description: `Plan intensivo de 4 semanas generado automáticamente para ${assignedAthletes.length} atletas.`,
                    coach: coach._id,
                    athletes: assignedAthletes.map(a => a._id),
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 mes después
                    isActive: true
                });
                await plan.save();
                plans.push(plan);

                // Cada plan tiene de 3 a 5 sesiones (Workout)
                for (let w = 1; w <= Math.floor(Math.random() * 3) + 3; w++) {
                    const workoutDate = new Date(Date.now() + w * 2 * 24 * 60 * 60 * 1000);
                    workoutDate.setUTCHours(12, 0, 0, 0); // Establecer a mediodía UTC

                    const workout = new Workout({
                        plan: plan._id,
                        date: workoutDate, // En los próximos días a mediodía
                        time: `${String(16 + (w % 4)).padStart(2, '0')}:00`,
                        name: `Sesión ${w} del Plan`,
                        exercises: [
                            { name: 'Calentamiento de Movilidad', type: 'other', parameters: { duration: '10 min' } },
                            { name: 'Sentadillas', type: 'strength', parameters: { sets: 4, reps: 10, rpe: 8 } },
                            { name: 'Dominadas', type: 'strength', parameters: { sets: 3, reps: 'al fallo', rpe: 9 } },
                            { name: 'Plancha Abdominal', type: 'other', parameters: { duration: '1 min', sets: 3 } }
                        ],
                        notes: 'Mantener buena técnica. No forzar si hay dolor.'
                    });
                    workoutsPromises.push(workout.save());
                }
            }
        }
        const savedWorkouts = await Promise.all(workoutsPromises);
        console.log(`Creados: ${plans.length} Planes de Entrenamiento y ${savedWorkouts.length} Plantillas de Sesiones (Workouts).`);

        console.log('Generando Logs de Entrenamiento de Ejemplo para los Atletas...');
        const logsPromises = [];
        // Creamos logs retroactivos para algunas sesiones
        for (const workout of savedWorkouts) {
            const plan = plans.find(p => p._id.toString() === workout.plan.toString());
            // Solo algunos de los atletas en el plan completarán el log correspondiente a esta plantilla
            const completingAthletes = plan.athletes.slice(0, Math.floor(plan.athletes.length / 2));

            for (const athleteId of completingAthletes) {
                const dl = new Date(workout.date.getTime() - Math.random() * 24 * 60 * 60 * 1000);
                dl.setUTCHours(12, 0, 0, 0);

                const log = new WorkoutLog({
                    athlete: athleteId,
                    workout: workout._id,
                    date: dl,
                    completed: true,
                    exercises: workout.exercises.map(ex => ({
                        name: ex.name,
                        sets: ex.parameters?.sets || 1,
                        reps: typeof ex.parameters?.reps === 'number' ? ex.parameters.reps : 12,
                        load: ex.type === 'strength' ? `${Math.floor(Math.random() * 60) + 10}kg` : null,
                        completed: true,
                        notes: 'Buenas sensaciones, podría subir carga'
                    })),
                    notes: 'Entrenamiento muy exigente en la parte de piernas.'
                });
                logsPromises.push(log.save());
            }
        }
        const savedLogs = await Promise.all(logsPromises);
        console.log(`Creados: ${savedLogs.length} Logs de Sesiones Reales (WorkoutLog) completados.`);

        console.log('Seed finalizado correctamente! La base de datos dev está cargada con múltiples datos de prueba.');
        process.exit(0);
    } catch (error) {
        console.error('Error durante el Seeding de la base de datos:', error);
        process.exit(1);
    }
};

seedDatabase();
