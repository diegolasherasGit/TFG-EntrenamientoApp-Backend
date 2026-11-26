/**
 * Datos de apoyo para el vídeo del entrenador de la defensa.
 *
 * El administrador da de alta a Hugo Bernal en el primer vídeo, así que, al
 * grabar el segundo, Hugo no tiene a nadie: su panel de estadísticas saldría a
 * cero. Este script le crea otro plan con cuatro escaladores del seed de
 * Maestro y sesiones de ESTA semana, unas ya hechas y otras pendientes. Nada de
 * semanas anteriores: su cuenta es de hoy y el panel no debe enseñar historia.
 *
 * Se ejecuta entre el vídeo del administrador y el del entrenador
 * (scripts/demo-roles-grabar.sh en el móvil), sobre el seed de Maestro.
 *
 * Ejecutar: pnpm run seed:demo-entrenador
 */
import '../config/db.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../models/User.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import Workout from '../models/templates/Workout.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import softDeletePlugin from '../models/plugins/softDelete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/entrenamiento_db';
const COACH_EMAIL = process.env.DEMO_COACH_EMAIL || 'hugo.entrenador@bulderland.com';
const PLAN_NAME = 'Continuidad en Bloque';

// Escaladores del seed con abono activo
const ATHLETE_EMAILS = [
    'javier.atleta@bulderland.com',
    'marcos.atleta@bulderland.com',
    'laura.atleta@bulderland.com',
    'sofia.atleta@bulderland.com',
];

/** Día de la semana actual (0 = lunes) a la hora indicada. */
function thisWeek(dayIndex, hour) {
    // Mismo criterio que getWeekBounds del panel: la semana empieza el lunes
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1) + dayIndex);
    d.setHours(hour, 0, 0, 0);
    return d;
}

// `registro` es lo que anota el escalador al terminar: la carga real y sus
// sensaciones. Admite un valor común y otro por persona.
const SESSIONS = [
    {
        day: 0, hour: 8, time: '08:00',
        name: 'Bloque 1 - Travesías',
        exercises: [
            {
                name: 'Travesía en muro', type: 'climbing',
                parameters: { duration: '20 min' },
                registro: { notes: 'Cuatro vueltas sin bajarme.' },
            },
            {
                name: 'Suspensiones en regleta', type: 'strength',
                parameters: { sets: 4, reps: 8 },
                registro: {
                    load: '18kg',
                    'javier.atleta@bulderland.com': { load: '22kg', notes: 'La ultima serie, justa.' },
                },
            },
        ],
        // quién la ha registrado ya, si la sesión ha pasado
        done: ['javier.atleta@bulderland.com', 'marcos.atleta@bulderland.com', 'laura.atleta@bulderland.com'],
        notas: { 'javier.atleta@bulderland.com': 'Buenas sensaciones, sin molestias en los dedos.' },
    },
    {
        day: 2, hour: 18, time: '18:00',
        name: 'Bloque 2 - 4x4',
        exercises: [
            { name: '4x4 en bloque', type: 'climbing', parameters: { sets: 4, reps: 4 } },
            {
                name: 'Dominadas', type: 'strength', parameters: { sets: 3, reps: 6 },
                registro: { load: '+10kg' },
            },
        ],
        done: ['javier.atleta@bulderland.com', 'laura.atleta@bulderland.com'],
    },
    {
        day: 4, hour: 18, time: '18:00',
        name: 'Bloque 3 - Circuito largo',
        exercises: [
            { name: 'Circuito de 30 movimientos', type: 'climbing', parameters: { sets: 3, reps: 1 } },
            { name: 'Plancha abdominal', type: 'other', parameters: { sets: 3, duration: '45 s' } },
        ],
        done: ['javier.atleta@bulderland.com'],
    },
];

const run = async () => {
    try {
        mongoose.plugin(softDeletePlugin);
        await mongoose.connect(mongoUri);

        const coach = await User.findOne({ email: COACH_EMAIL, role: 'coach' });
        if (!coach) {
            throw new Error(`No existe el entrenador ${COACH_EMAIL}: se crea en el vídeo del administrador`);
        }
        const athletes = await User.find({ email: { $in: ATHLETE_EMAILS } });
        if (athletes.length !== ATHLETE_EMAILS.length) {
            throw new Error('Faltan escaladores del seed de Maestro: ejecuta antes seed:maestro');
        }
        const byEmail = new Map(athletes.map((a) => [a.email, a]));

        // Repetible: si ya existía de una ejecución anterior, se rehace
        const previous = await TrainingPlan.find({ coach: coach._id, name: PLAN_NAME });
        for (const p of previous) {
            const ids = await Workout.find({ plan: p._id }).distinct('_id');
            await WorkoutLog.deleteMany({ workout: { $in: ids } });
            await Workout.deleteMany({ plan: p._id });
            await TrainingPlan.deleteOne({ _id: p._id });
        }

        const plan = await TrainingPlan.create({
            name: PLAN_NAME,
            description: 'Tres sesiones por semana de continuidad y resistencia en bloque.',
            coach: coach._id,
            athletes: athletes.map((a) => a._id),
            startDate: thisWeek(0, 8),
            endDate: thisWeek(27, 20),
            isActive: true,
        });

        const now = new Date();
        let logs = 0;
        for (const s of SESSIONS) {
            const date = thisWeek(s.day, s.hour);
            const w = await Workout.create({
                plan: plan._id,
                date,
                time: s.time,
                name: s.name,
                estimatedDuration: 60,
                exercises: s.exercises,
                isActive: true,
            });
            if (date >= now) {
                continue;
            }
            for (const email of s.done) {
                await WorkoutLog.create({
                    athlete: byEmail.get(email)._id,
                    workout: w._id,
                    date,
                    completed: true,
                    // lo que el escalador anota de verdad: la carga que movió,
                    // el tiempo que aguantó y alguna sensación. Es lo que el
                    // entrenador lee en «Registros de ...»
                    exercises: s.exercises.map((ex) => ({
                        name: ex.name,
                        sets: ex.parameters?.sets,
                        reps: ex.parameters?.reps,
                        duration: ex.parameters?.duration,
                        load: ex.registro?.[email]?.load ?? ex.registro?.load,
                        notes: ex.registro?.[email]?.notes ?? ex.registro?.notes,
                        completed: true,
                    })),
                    notes: s.notas?.[email],
                    isActive: true,
                });
                logs++;
            }
        }

        console.log(`[Demo entrenador] "${PLAN_NAME}" para ${coach.name}: ` +
            `${athletes.length} escaladores, ${SESSIONS.length} sesiones esta semana, ${logs} registradas`);
        process.exit(0);
    } catch (error) {
        console.error('[Demo entrenador] Error:', error.message);
        process.exit(1);
    }
};

run();
