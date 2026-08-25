/**
 * Seed determinista para pruebas E2E con Maestro.
 * Datos legibles, fechas relativas a "hoy" (la fecha real de ejecución) y usuarios con emails fijos.
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
import ExercisePhoto from '../models/ExercisePhoto.js';
import Notification from '../models/Notification.js';
import softDeletePlugin from '../models/plugins/softDelete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// El seed se ejecuta dentro de Docker (`... exec backend pnpm run seed:maestro`),
// donde el host de Mongo es el servicio `mongo`.
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/entrenamiento_db';

/** ObjectIds fijos para que Maestro pueda restaurar usuarios por ID */
export const MAESTRO_IDS = {
    admin: '666666666666666666666601',
    coach: '666666666666666666666602',
    athlete: '666666666666666666666603',
    deletedUser: '666666666666666666666664',
    plan: '666666666666666666666611',
    explorePlan: '666666666666666666666612',
    // Vídeo de técnica asociado al ejercicio "Dominadas Lastradas" de la sesión de hoy
    techniqueVideoSquat: '666666666666666666666622',
    // Fotos de ejercicio (biblioteca del admin) asociadas a la sesión de hoy
    exercisePhotoSquat: '666666666666666666666631',
    exercisePhotoBench: '666666666666666666666632',
    // Usuario "víctima" que el flow E2E del admin borra desde Gestionar
    expendableUser: '666666666666666666666606',

    // --- Dataset "tamaño producción": equipo y planes adicionales ---
    // Estos datos NO los tocan los flujos (no se anclan por nombre/id), pero
    // dan volumen realista a paneles y estadísticas (atletas activos, actividad
    // del equipo, métricas de plataforma) para que un suite verde sea una
    // señal creíble de "listo para producción".
    coach2: '666666666666666666666607',
    athleteMarcos: '666666666666666666666641',
    athleteSofia: '666666666666666666666642',
    athleteJavier: '666666666666666666666643',
    athleteNuria: '666666666666666666666644',
    athletePablo: '666666666666666666666645',
    planResistencia: '666666666666666666666613',
    planPretemporada: '666666666666666666666614',
    planIniciacionElite: '666666666666666666666615',
};

const PASSWORD = 'password123';

function atNoon(daysOffset = 0) {
    // "Hoy" = fecha real de ejecución del seed, normalizada a las 12:00.
    // Así las sesiones relativas (hoy / mañana / pasadas) coinciden con el reloj
    // del dispositivo, que es lo que usan la app y los flujos E2E de Maestro
    // (p. ej. "Día 3 - Potencia y Bloque" cae siempre en el día actual).
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + daysOffset);
    return d;
}

function planBounds() {
    const start = atNoon(-14);
    const end = atNoon(28);
    return { start, end };
}

const seedMaestro = async () => {
    try {
        console.log(`[Maestro Seed] Conectando a ${mongoUri}`);
        mongoose.plugin(softDeletePlugin);
        await mongoose.connect(mongoUri);

        console.log('[Maestro Seed] Limpiando colecciones...');
        await Promise.all([
            User.deleteMany({}),
            TrainingStats.deleteMany({}),
            TrainingPlan.deleteMany({}),
            Workout.deleteMany({}),
            WorkoutLog.deleteMany({}),
            TechniqueVideo.deleteMany({}),
            ExercisePhoto.deleteMany({}),
            Notification.deleteMany({}),
        ]);

        const hashedPassword = await bcrypt.hash(PASSWORD, 12);
        const { start: planStart, end: planEnd } = planBounds();

        const admin = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.admin),
            name: 'Admin Bulderland',
            email: 'administrador@bulderland.com',
            password: PASSWORD,
            role: 'admin',
            isVerified: true,
        });

        const coach = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.coach),
            name: 'Carlos Mendoza',
            email: 'carlos.entrenador@bulderland.com',
            password: PASSWORD,
            role: 'coach',
            isVerified: true,
        });

        const athlete = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.athlete),
            name: 'Laura Gómez',
            email: 'laura.atleta@bulderland.com',
            password: PASSWORD,
            role: 'athlete',
            isVerified: true,
            // Abono activo: Laura accede al contenido de entrenamiento (de lo
            // contrario el gate requireActiveMembership la dejaría fuera).
            dni: '12345678Z',
            membership: { status: 'active', plan: 'trimestral', validUntil: atNoon(75) },
        });

        await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.deletedUser),
            name: 'Usuario Eliminado',
            email: 'eliminado.usuario@bulderland.com',
            password: hashedPassword,
            role: 'athlete',
            isVerified: true,
            isDeleted: true,
        });

        // Atleta prescindible: el flow E2E de admin lo borra desde "Gestionar"
        await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.expendableUser),
            name: 'Usuario Borrable',
            email: 'borrable@bulderland.com',
            password: hashedPassword,
            role: 'athlete',
            isVerified: true,
        });

        // --- Segundo entrenador y resto del equipo (volumen "producción") ---
        const coach2 = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.coach2),
            name: 'Elena Ruiz',
            email: 'elena.entrenadora@bulderland.com',
            password: PASSWORD,
            role: 'coach',
            isVerified: true,
        });

        const marcos = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.athleteMarcos),
            name: 'Marcos Díaz',
            email: 'marcos.atleta@bulderland.com',
            password: PASSWORD,
            role: 'athlete',
            isVerified: true,
        });

        const sofia = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.athleteSofia),
            name: 'Sofía Navarro',
            email: 'sofia.atleta@bulderland.com',
            password: PASSWORD,
            role: 'athlete',
            isVerified: true,
        });

        const javier = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.athleteJavier),
            name: 'Javier Soler',
            email: 'javier.atleta@bulderland.com',
            password: PASSWORD,
            role: 'athlete',
            isVerified: true,
        });

        // Atleta sin plan ni actividad: cubre el "empty state" en producción.
        // Llega además con el abono SOLICITADO (pending) y su DNI ya aportado,
        // para que el flujo E2E del admin pueda activarle el abono ante la cámara
        // (filtro "Pendientes" -> ver DNI -> activar eligiendo tipo de abono).
        await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.athleteNuria),
            name: 'Nuria Cano',
            email: 'nuria.atleta@bulderland.com',
            password: PASSWORD,
            role: 'athlete',
            isVerified: true,
            dni: '87654321X',
            membership: { status: 'pending', requestedAt: new Date() },
        });

        const pablo = await User.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.athletePablo),
            name: 'Pablo Vidal',
            email: 'pablo.atleta@bulderland.com',
            password: PASSWORD,
            role: 'athlete',
            isVerified: true,
        });

        await TrainingStats.create({
            user: athlete._id,
            totalWorkouts: 15,
            totalExercises: 92,
            lastWorkoutDate: atNoon(-2),
        });

        // Estadísticas del resto del equipo (Nuria queda sin stats: atleta nuevo
        // sin actividad). Dan números reales a "Atletas activos" y a las gráficas.
        await TrainingStats.insertMany([
            {
                user: marcos._id,
                totalWorkouts: 9,
                totalExercises: 54,
                lastWorkoutDate: atNoon(-1),
            },
            {
                user: sofia._id,
                totalWorkouts: 22,
                totalExercises: 130,
                lastWorkoutDate: atNoon(-46),
            },
            {
                user: javier._id,
                totalWorkouts: 4,
                totalExercises: 21,
                lastWorkoutDate: atNoon(-3),
            },
            {
                user: pablo._id,
                totalWorkouts: 2,
                totalExercises: 11,
                lastWorkoutDate: atNoon(-4),
            },
        ]);

        const plan = await TrainingPlan.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.plan),
            name: 'Programa Élite - Fuerza y Escalada',
            description: 'Programa intensivo de 4 semanas diseñado para mejorar la fuerza de agarre, potencia en bloque y resistencia en vías largas.',
            coach: coach._id,
            // Plan multi-atleta: además de Laura (anclaje de los flujos E2E),
            // Marcos y Sofía dan al panel del coach un recuento realista.
            athletes: [athlete._id, marcos._id, sofia._id],
            startDate: planStart,
            endDate: planEnd,
            isActive: true,
        });

        const workoutTemplates = [
            {
                date: atNoon(-7),
                time: '18:00',
                name: 'Día 1 - Fuerza Máxima',
                exercises: [
                    { name: 'Dominadas Lastradas', type: 'strength', parameters: { sets: 4, reps: 8, load: '+20kg' } },
                    { name: 'Suspensiones en Regleta', type: 'strength', parameters: { sets: 3, reps: 10, load: '+10kg' } },
                ],
                notes: 'Primera sesión del ciclo.',
            },
            {
                date: atNoon(-5),
                time: '19:00',
                name: 'Día 1 - Resistencia Base',
                exercises: [
                    { name: 'Travesía en muro', type: 'climbing', parameters: { duration: '30 min' } },
                    { name: 'Dominadas asistidas', type: 'strength', parameters: { sets: 3, reps: 12 } },
                ],
                notes: 'Buen trabajo de resistencia.',
            },
            {
                date: atNoon(-2),
                time: '17:30',
                name: 'Día 2 - Vías de Continuidad',
                exercises: [
                    { name: 'Calentamiento en bloque', type: 'climbing', parameters: { duration: '15 min' } },
                    { name: 'Boulder técnico', type: 'climbing', parameters: { problems: 8, grade: '6a' } },
                    { name: 'Tracciones en regleta', type: 'strength', parameters: { sets: 3, reps: 8 } },
                ],
                notes: 'Sesión ya registrada por la atleta.',
            },
            {
                date: atNoon(0),
                time: '18:00',
                name: 'Día 3 - Potencia y Bloque',
                exercises: [
                    { name: 'Dominadas Lastradas', type: 'strength', parameters: { sets: 4, reps: 8, load: '+25kg', rpe: 7 }, notes: 'Mantener la verticalidad del torso.', techniqueVideo: new mongoose.Types.ObjectId(MAESTRO_IDS.techniqueVideoSquat), exercisePhoto: new mongoose.Types.ObjectId(MAESTRO_IDS.exercisePhotoSquat) },
                    { name: 'Suspensiones en Regleta', type: 'strength', parameters: { sets: 3, reps: 10, load: '+15kg', rpe: 7 }, exercisePhoto: new mongoose.Types.ObjectId(MAESTRO_IDS.exercisePhotoBench) },
                    { name: 'Campus Board', type: 'strength', parameters: { sets: 3, reps: 8, load: '+5kg', rpe: 6 }, notes: 'Controlar la fase excentrica.' },
                ],
                notes: 'Priorizar técnica sobre carga.',
                // Dos atletas ya apuntados a esta sesión (para que el coach lo vea en su flujo E2E).
                // Laura NO está apuntada de inicio: su flujo E2E demuestra el "Apuntarme a la sesión".
                attendees: [marcos._id, sofia._id],
            },
            {
                date: atNoon(1),
                time: '19:00',
                name: 'Día 4 - Resistencia en Vía',
                exercises: [
                    { name: 'Carrera continua', type: 'endurance', parameters: { duration: '25 min' } },
                    { name: 'Plancha abdominal', type: 'other', parameters: { sets: 3, duration: '45 s' } },
                ],
                notes: 'Ritmo moderado, conversacional.',
            },
            {
                date: atNoon(3),
                time: '18:30',
                name: 'Día 5 - Proyectos al Límite',
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
                time: tpl.time,
                name: tpl.name,
                estimatedDuration: 60,
                exercises: tpl.exercises,
                notes: tpl.notes,
                // Atletas apuntados a la sesión (asistencia previa); por defecto ninguno
                attendees: tpl.attendees || [],
            });
            workouts.push(w);
        }

        await TrainingPlan.create({
            _id: new mongoose.Types.ObjectId(MAESTRO_IDS.explorePlan),
            name: 'Plan de Iniciación al Boulder',
            description: 'Plan gratuito de 2 semanas para conocer los fundamentos de la escalada en bloque.',
            coach: coach._id,
            athletes: [],
            startDate: planStart,
            endDate: planEnd,
            isActive: true,
        });

        // Registrar como completados todos los entrenamientos anteriores a "hoy"
        const pastWorkouts = workouts.filter((w) => w.date < atNoon(0));
        for (const pw of pastWorkouts) {
            await WorkoutLog.create({
                athlete: athlete._id,
                workout: pw._id,
                date: pw.date,
                completed: true,
                exercises: pw.exercises.map((ex) => ({
                    name: ex.name,
                    sets: ex.parameters?.sets || 1,
                    reps: typeof ex.parameters?.reps === 'number' ? ex.parameters.reps : 10,
                    load: ex.type === 'strength' ? '40kg' : null,
                    completed: true,
                    notes: 'Dominadas fluidas, buena sensación de agarre.',
                })),
                notes: 'Día intenso, pero con muy buena progresión en la técnica.',
            });
        }

        // --- Planes adicionales (no anclados por los flujos) ---
        // Crea un plan con sus sesiones y registra como completadas las pasadas
        // para los atletas indicados. Esto puebla calendario, estadísticas de
        // equipo y métricas de plataforma con datos verosímiles.
        const seedPlanWithWorkouts = async ({ id, name, description, coachUser, athleteUsers, startDate, endDate, sessions }) => {
            const created = await TrainingPlan.create({
                _id: id ? new mongoose.Types.ObjectId(id) : new mongoose.Types.ObjectId(),
                name,
                description,
                coach: coachUser._id,
                athletes: athleteUsers.map((u) => u._id),
                startDate,
                endDate,
                isActive: true,
            });

            for (const s of sessions) {
                const w = await Workout.create({
                    plan: created._id,
                    date: s.date,
                    time: s.time,
                    name: s.name,
                    estimatedDuration: s.estimatedDuration || 60,
                    exercises: s.exercises,
                    notes: s.notes,
                });

                if (w.date < atNoon(0)) {
                    // Cada atleta inscrito registra la sesión pasada como completada
                    for (const u of athleteUsers) {
                        await WorkoutLog.create({
                            athlete: u._id,
                            workout: w._id,
                            date: w.date,
                            completed: true,
                            exercises: w.exercises.map((ex) => ({
                                name: ex.name,
                                sets: ex.parameters?.sets || 1,
                                reps: typeof ex.parameters?.reps === 'number' ? ex.parameters.reps : 10,
                                load: ex.type === 'strength' ? '35kg' : null,
                                completed: true,
                                notes: 'Sesión completada según lo previsto.',
                            })),
                            notes: 'Buen ritmo, sin incidencias.',
                        });
                    }
                }
            }

            return created;
        };

        // Plan activo en curso (Carlos): Marcos y Javier, mezcla de sesiones
        // pasadas (completadas) y futuras.
        await seedPlanWithWorkouts({
            id: MAESTRO_IDS.planResistencia,
            name: 'Plan Resistencia y Volumen',
            description: 'Bloque de 4 semanas centrado en capacidad aeróbica y volumen de tracciones.',
            coachUser: coach,
            athleteUsers: [marcos, javier],
            startDate: atNoon(-10),
            endDate: atNoon(20),
            sessions: [
                {
                    date: atNoon(-6), time: '18:00', name: 'Volumen 1 - Tracciones',
                    exercises: [
                        { name: 'Dominadas asistidas', type: 'strength', parameters: { sets: 4, reps: 12 } },
                        { name: 'Travesía en muro', type: 'climbing', parameters: { duration: '20 min' } },
                    ],
                    notes: 'Mantener cadencia constante.',
                },
                {
                    date: atNoon(-3), time: '19:00', name: 'Resistencia Aeróbica',
                    exercises: [
                        { name: 'Carrera continua', type: 'endurance', parameters: { duration: '30 min' } },
                    ],
                    notes: 'Ritmo conversacional.',
                },
                {
                    date: atNoon(2), time: '18:30', name: 'Volumen 2 - Continuidad',
                    exercises: [
                        { name: 'Vías de continuidad', type: 'climbing', parameters: { problems: 6, grade: '5+' } },
                    ],
                    notes: 'Cuidar la técnica de pies al acumular fatiga.',
                },
            ],
        });

        // Plan ya finalizado (Carlos): Sofía. endDate en el pasado → histórico
        // que enriquece estadísticas sin aparecer como "próxima sesión".
        await seedPlanWithWorkouts({
            id: MAESTRO_IDS.planPretemporada,
            name: 'Pretemporada Otoño',
            description: 'Ciclo de acondicionamiento general previo a la temporada de competición.',
            coachUser: coach,
            athleteUsers: [sofia],
            startDate: atNoon(-75),
            endDate: atNoon(-45),
            sessions: [
                {
                    date: atNoon(-70), time: '17:30', name: 'Acondicionamiento General',
                    exercises: [
                        { name: 'Circuito de core', type: 'other', parameters: { sets: 3, reps: 15 } },
                        { name: 'Movilidad de hombro', type: 'other', parameters: { duration: '10 min' } },
                    ],
                    notes: 'Base de la pretemporada.',
                },
                {
                    date: atNoon(-55), time: '18:00', name: 'Fuerza Base',
                    exercises: [
                        { name: 'Dominadas Lastradas', type: 'strength', parameters: { sets: 5, reps: 5, load: '+5kg' } },
                    ],
                    notes: 'Progresión de carga semanal.',
                },
            ],
        });

        // Plan de la segunda entrenadora (Elena): Pablo. Demuestra multi-coach
        // en las estadísticas de plataforma del admin.
        await seedPlanWithWorkouts({
            id: MAESTRO_IDS.planIniciacionElite,
            name: 'Iniciación Élite - Escuela',
            description: 'Plan introductorio supervisado por la entrenadora Elena Ruiz.',
            coachUser: coach2,
            athleteUsers: [pablo],
            startDate: atNoon(-5),
            endDate: atNoon(25),
            sessions: [
                {
                    date: atNoon(-2), time: '17:00', name: 'Fundamentos de Bloque',
                    exercises: [
                        { name: 'Calentamiento en bloque', type: 'climbing', parameters: { duration: '15 min' } },
                        { name: 'Boulder técnico', type: 'climbing', parameters: { problems: 5, grade: '5a' } },
                    ],
                    notes: 'Foco en colocación de pies.',
                },
                {
                    date: atNoon(4), time: '17:00', name: 'Equilibrio y Pies',
                    exercises: [
                        { name: 'Footwork drills', type: 'climbing', parameters: { duration: '25 min' } },
                    ],
                    notes: 'Silencio total al apoyar el pie.',
                },
            ],
        });

        // Solo se siembran tipos que la app genera de verdad (system y
        // workout_updated); plan_assigned y other existen en el enum pero ningún
        // flujo de la app los produce. Textos calcados de los controladores.
        await Notification.insertMany([
            // --- Atleta (Laura): avisos de SUS sesiones (workout_updated) y de su plan/abono (system) ---
            {
                user: athlete._id,
                type: 'workout_updated',
                title: 'Nueva sesión añadida',
                message: 'Se ha añadido la sesión Día 4 - Resistencia en Vía al plan Programa Élite - Fuerza y Escalada.',
                read: false,
                relatedId: plan._id,
            },
            {
                user: athlete._id,
                type: 'workout_updated',
                title: 'Sesión actualizada',
                message: 'La sesión Día 3 - Potencia y Bloque del plan Programa Élite - Fuerza y Escalada ha sido actualizada.',
                read: false,
                relatedId: plan._id,
            },
            {
                user: athlete._id,
                type: 'system',
                title: 'Plan actualizado',
                message: 'El plan Programa Élite - Fuerza y Escalada ha sido actualizado.',
                read: true,
                relatedId: plan._id,
            },
            {
                user: athlete._id,
                type: 'system',
                title: 'Abono activado',
                message: 'Tu abono (Trimestral) ya está activo. Ya puedes acceder a tus entrenamientos en Bulderland.',
                read: true,
            },
            // --- Coach (Carlos): solo recibe actividad de sus atletas (system) ---
            {
                user: coach._id,
                type: 'system',
                title: 'Entrenamiento completado',
                message: 'Laura Gómez ha completado "Día 3 - Potencia y Bloque".',
                read: false,
            },
            {
                user: coach._id,
                type: 'system',
                title: 'Nuevo atleta apuntado',
                message: 'Marcos Díaz se ha apuntado a la sesión: Día 3 - Potencia y Bloque',
                read: false,
            },
            {
                user: coach._id,
                type: 'system',
                title: 'Entrenamiento completado',
                message: 'Sofía Navarro ha completado "Día 2 - Vías de Continuidad".',
                read: true,
            },
            // --- Admin: solo recibe solicitudes de abono (system) ---
            {
                user: admin._id,
                type: 'system',
                title: 'Solicitud de abono',
                message: 'Nuria Cano (nuria.atleta@bulderland.com) solicita activar su abono. DNI: 87654321X',
                read: false,
            },
            {
                user: admin._id,
                type: 'system',
                title: 'Solicitud de abono',
                message: 'Pablo Vidal (pablo.atleta@bulderland.com) solicita activar su abono. DNI: 12345678Z',
                read: true,
            },
            // --- Volumen: otros atletas con avisos reales de sesiones ---
            {
                user: marcos._id,
                type: 'workout_updated',
                title: 'Sesión actualizada',
                message: 'La sesión Día 1 - Resistencia Base del plan Plan Resistencia y Volumen ha sido actualizada.',
                read: false,
            },
            {
                user: javier._id,
                type: 'workout_updated',
                title: 'Sesión eliminada',
                message: 'La sesión Carrera continua ha sido eliminada del plan Plan Resistencia y Volumen.',
                read: true,
            },
        ]);

        // Fotos de ejercicio embebidas como data URI: la demo no depende de red
        await ExercisePhoto.insertMany([
            {
                _id: new mongoose.Types.ObjectId(MAESTRO_IDS.exercisePhotoSquat),
                title: 'Postura en dominada',
                description: 'Escápulas activas, tracción vertical controlada.',
                imageUrl: 'data:image/jpeg;base64,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',
                exerciseType: 'strength',
            },
            {
                _id: new mongoose.Types.ObjectId(MAESTRO_IDS.exercisePhotoBench),
                title: 'Suspensión en Semiarqueo',
                description: 'Posición de semiarqueo en regleta de 20mm.',
                imageUrl: 'data:image/jpeg;base64,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',
                exerciseType: 'strength',
            },
        ]);

        await TechniqueVideo.insertMany([
            {
                _id: new mongoose.Types.ObjectId(MAESTRO_IDS.techniqueVideoSquat),
                title: 'Técnica de Dominadas Lastradas',
                description: 'Explicación detallada de la activación muscular y posición correcta.',
                videoUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
                exerciseType: 'strength',
            },
            {
                title: 'Suspensiones Max Hangs',
                description: 'Protocolo de fuerza máxima en multipresa.',
                videoUrl: 'https://www.youtube.com/watch?v=1xN5-z2B9p8',
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
            // Vídeos extra para cubrir todos los tipos de ejercicio del filtro
            // (endurance / other) y que la videoteca luzca poblada en producción.
            {
                title: 'Respiración en vías largas',
                description: 'Gestión del esfuerzo y la respiración en resistencia.',
                videoUrl: 'https://www.youtube.com/watch?v=GZrn-haEUHk',
                exerciseType: 'endurance',
            },
            {
                title: 'Movilidad de hombro para escaladores',
                description: 'Rutina de prevención y movilidad articular.',
                videoUrl: 'https://www.youtube.com/watch?v=2HoQDi6dD4Y',
                exerciseType: 'other',
            },
        ]);

        const [userCount, planCount, workoutCount, logCount] = await Promise.all([
            User.countDocuments({ isDeleted: { $ne: true } }),
            TrainingPlan.countDocuments({ isActive: true }),
            Workout.countDocuments({}),
            WorkoutLog.countDocuments({}),
        ]);

        console.log('\n========== MAESTRO SEED — Credenciales ==========');
        console.log(`Admin:   ${admin.email} / ${PASSWORD}`);
        console.log(`Coach:   ${coach.email} / ${PASSWORD}`);
        console.log(`Coach 2: ${coach2.email} / ${PASSWORD}`);
        console.log(`Atleta:  ${athlete.email} / ${PASSWORD}`);
        console.log(`Eliminado (restaurar): ${MAESTRO_IDS.deletedUser}`);
        console.log('Plan visible: "Programa Élite - Fuerza y Escalada"');
        console.log('Plan explorar: "Plan de Iniciación al Boulder"');
        console.log('Sesión de hoy: "Día 3 - Potencia y Bloque"');
        console.log('Notificación: "Nuevo plan asignado"');
        console.log('------------------------------------------------');
        console.log('Dataset "tamaño producción":');
        console.log(`  Usuarios activos: ${userCount} (2 coaches, 6 atletas, 1 admin + 1 borrable)`);
        console.log(`  Planes activos:   ${planCount}   Sesiones: ${workoutCount}   Logs: ${logCount}`);
        console.log('  Estados cubiertos: plan en curso, finalizado, futuro, sin inscritos y atleta sin plan');
        console.log('================================================\n');

        process.exit(0);
    } catch (error) {
        console.error('[Maestro Seed] Error:', error);
        process.exit(1);
    }
};

seedMaestro();
