/**
 * Seed determinista para pruebas E2E con Maestro.
 * Datos legibles, fechas relativas a "hoy" y usuarios con emails fijos.
 *
 * Ejecutar: pnpm run seed:maestro
 */
import '../config/db.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../models/User.js';
import TrainingStats from '../models/TrainingStats.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import Workout from '../models/templates/Workout.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import TechniqueVideo from '../models/TechniqueVideo.js';
import Notification from '../models/Notification.js';
import softDeletePlugin from '../models/plugins/softDelete.js';
import { resolveMongoUri } from '../utils/resolveMongoUri.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const localUri = resolveMongoUri();

/** ObjectIds fijos para que Maestro pueda restaurar usuarios por ID */
export const MAESTRO_IDS = {
    admin: '666666666666666666666601',
    coach: '666666666666666666666602',
    athlete: '666666666666666666666603',
    deletedUser: '666666666666666666666664',
    plan: '666666666666666666666611',
    explorePlan: '666666666666666666666612',
};

const PASSWORD = 'password123';

function atNoon(daysOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(12, 0, 0, 0);
    return d;
}

function planBounds() {
    const start = atNoon(-14);
    const end = atNoon(28);
    return { start, end };
}

const seedMaestro = async () => {
    try {
        console.log(`[Maestro Seed] Conectando a ${localUri}`);
        mongoose.plugin(softDeletePlugin);
        await mongoose.connect(localUri);

        console.log('[Maestro Seed] Limpiando colecciones...');
        await Promise.all([
            User.deleteMany({}),
            TrainingStats.deleteMany({}),
            TrainingPlan.deleteMany({}),
            Workout.deleteMany({}),
            WorkoutLog.deleteMany({}),
            TechniqueVideo.deleteMany({}),
            Notification.deleteMany({}),
        ]);

        const hashedPassword = await bcrypt.hash(PASSWORD, 12);
        const { start: planStart, end: planEnd } = planBounds();

        const admin = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.admin),
            name: 'Administrador Demo',
            email: 'admin@test.com',
            password: PASSWORD,
            role: 'admin',
            isVerified: true,
        });

        const coach = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.coach),
            name: 'Carlos Méndez',
            email: 'coach.demo@bulderland.com',
            password: PASSWORD,
            role: 'coach',
            isVerified: true,
        });

        const athlete = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.athlete),
            name: 'Laura García',
            email: 'atleta.demo@bulderland.com',
            password: PASSWORD,
            role: 'athlete',
            isVerified: true,
        });

        await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.deletedUser),
            name: 'Usuario Eliminado',
            email: 'eliminado@bulderland.com',
            password: hashedPassword,
            role: 'athlete',
            isVerified: true,
            isDeleted: true,
        });

        await TrainingStats.create({
            user: athlete._id,
            totalWorkouts: 12,
            totalExercises: 84,
            lastWorkoutDate: atNoon(-2),
            bestLifts: [
                { exerciseName: 'Sentadillas', value: '80kg' },
                { exerciseName: 'Dominadas', value: '12 reps' },
                { exerciseName: 'Press banca', value: '60kg' },
            ],
        });

        const plan = await TrainingPlan.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.plan),
            name: 'Plan Fuerza Básica',
            description: 'Plan de 4 semanas para escalada y fuerza. Ideal para demostración.',
            coach: coach._id,
            athletes: [athlete._id],
            startDate: planStart,
            endDate: planEnd,
            isActive: true,
        });

        const workoutTemplates = [
            {
                date: atNoon(-2),
                name: 'Sesión completada - Escalada',
                exercises: [
                    { name: 'Calentamiento en bloque', type: 'climbing', parameters: { duration: '15 min' } },
                    { name: 'Boulder técnico', type: 'climbing', parameters: { problems: 8, grade: '6a' } },
                    { name: 'Tracciones en regleta', type: 'strength', parameters: { sets: 3, reps: 8 } },
                ],
                notes: 'Sesión ya registrada por la atleta.',
            },
            {
                date: atNoon(0),
                name: 'Sesión de hoy - Fuerza',
                exercises: [
                    { name: 'Sentadillas', type: 'strength', parameters: { sets: 4, reps: 8, rpe: 7 } },
                    { name: 'Press banca', type: 'strength', parameters: { sets: 3, reps: 10, rpe: 7 } },
                    { name: 'Remo con mancuerna', type: 'strength', parameters: { sets: 3, reps: 12, rpe: 6 } },
                ],
                notes: 'Priorizar técnica sobre carga.',
            },
            {
                date: atNoon(1),
                name: 'Sesión mañana - Resistencia',
                exercises: [
                    { name: 'Carrera continua', type: 'endurance', parameters: { duration: '25 min' } },
                    { name: 'Plancha abdominal', type: 'other', parameters: { sets: 3, duration: '45 s' } },
                ],
                notes: 'Ritmo moderado, conversacional.',
            },
            {
                date: atNoon(3),
                name: 'Sesión viernes - Bloques',
                exercises: [
                    { name: 'Bloque dinámico', type: 'climbing', parameters: { duration: '20 min' } },
                    { name: 'Campus board', type: 'climbing', parameters: { sets: 4, reps: 6 } },
                ],
                notes: 'Buen día para probar proyectos.',
            },
        ];

        const workouts = [];
        for (const tpl of workoutTemplates) {
            const w = await Workout.create({
                plan: plan._id,
                date: tpl.date,
                name: tpl.name,
                estimatedDuration: 60,
                exercises: tpl.exercises,
                notes: tpl.notes,
            });
            workouts.push(w);
        }

        await TrainingPlan.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.explorePlan),
            name: 'Plan Exploración Voluntarios',
            description: 'Plan público para probar la pestaña Explorar (sin inscripción previa).',
            coach: coach._id,
            athletes: [],
            startDate: planStart,
            endDate: planEnd,
            isActive: true,
        });

        const completedWorkout = workouts.find((w) => w.name === 'Sesión completada - Escalada');
        await WorkoutLog.create({
            athlete: athlete._id,
            workout: completedWorkout._id,
            date: atNoon(-2),
            completed: true,
            exercises: completedWorkout.exercises.map((ex) => ({
                name: ex.name,
                sets: ex.parameters?.sets || 1,
                reps: typeof ex.parameters?.reps === 'number' ? ex.parameters.reps : 10,
                load: ex.type === 'strength' ? '40kg' : null,
                completed: true,
                notes: 'Buenas sensaciones',
            })),
            notes: 'Entrenamiento completado correctamente.',
        });

        await Notification.insertMany([
            {
                user: athlete._id,
                type: 'plan_assigned',
                title: 'Nuevo plan asignado',
                message: 'Carlos Méndez te ha asignado el Plan Fuerza Básica.',
                read: false,
                relatedId: plan._id,
            },
            {
                user: athlete._id,
                type: 'workout_updated',
                title: 'Sesión actualizada',
                message: 'Tu sesión de hoy ha sido revisada por tu entrenador.',
                read: true,
            },
        ]);

        await TechniqueVideo.insertMany([
            {
                title: 'Técnica de dominadas',
                description: 'Agarre, activación de escápulas y recorrido completo.',
                videoUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
                exerciseType: 'strength',
            },
            {
                title: 'Calentamiento antes de escalar',
                description: 'Rutina de 10 minutos para activar hombros y dedos.',
                videoUrl: 'https://www.youtube.com/watch?v=mtkq6P8Keq4',
                exerciseType: 'climbing',
            },
            {
                title: 'Footwork en boulder',
                description: 'Colocación de pies y transferencia de peso.',
                videoUrl: 'https://www.youtube.com/watch?v=IaZRCIb4Y84',
                exerciseType: 'climbing',
            },
        ]);

        console.log('\n========== MAESTRO SEED — Credenciales ==========');
        console.log(`Admin:   ${admin.email} / ${PASSWORD}`);
        console.log(`Coach:   ${coach.email} / ${PASSWORD}`);
        console.log(`Atleta:  ${athlete.email} / ${PASSWORD}`);
        console.log(`Eliminado (restaurar): ${MAESTRO_IDS.deletedUser}`);
        console.log('Plan visible: "Plan Fuerza Básica"');
        console.log('Plan explorar: "Plan Exploración Voluntarios"');
        console.log('Sesión de hoy: "Sesión de hoy - Fuerza"');
        console.log('Notificación: "Nuevo plan asignado"');
        console.log('================================================\n');

        process.exit(0);
    } catch (error) {
        console.error('[Maestro Seed] Error:', error);
        process.exit(1);
    }
};

seedMaestro();
