import request from 'supertest';
import ExcelJS from 'exceljs';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';
import TrainingPlan from '../../models/templates/TrainingPlan.js';
import Workout from '../../models/templates/Workout.js';
import WorkoutLog from '../../models/logs/WorkoutLog.js';
import User from '../../models/User.js';

describe('logController: exportCoachAthleteLogs', () => {
    let app, athleteToken, athleteId, workoutId, coachToken, adminToken, planId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_export_ctrl');
        ({ app, athleteToken, athleteId, workoutId, coachToken, adminToken, planId } = env);
    }, 60000);

    afterAll(async () => { await teardownTestEnv(); });

    it('coach sin atletas inscritos -> 404', async () => {
        const r = await request(app).get('/api/training/logs/export/coach')
            .set('Authorization', `Bearer ${coachToken}`);
        expect(r.status).toBe(404);
    });

    it('atleta no puede exportar -> 403', async () => {
        const r = await request(app).get('/api/training/logs/export/coach')
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(r.status).toBe(403);
    });

    it('admin no puede exportar (ruta reservada a coach) -> 403', async () => {
        const r = await request(app).get('/api/training/logs/export/coach')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(403);
    });

    it('coach con atletas y logs -> devuelve un .xlsx con una fila por ejercicio', async () => {
        await TrainingPlan.findByIdAndUpdate(planId, { $addToSet: { athletes: athleteId } });

        await request(app).post('/api/training/logs')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({
                workoutId,
                athleteId,
                completed: true,
                notes: 'Buena sesión',
                exercises: [
                    { name: 'Squat', sets: 3, reps: 10, load: '80kg', completed: true },
                    { name: 'Dominadas', sets: 4, reps: 8, load: 'BW', completed: true },
                ],
            });

        const r = await request(app).get('/api/training/logs/export/coach')
            .set('Authorization', `Bearer ${coachToken}`)
            .buffer(true)
            .parse((res, callback) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => callback(null, Buffer.concat(chunks)));
            });

        expect(r.status).toBe(200);
        expect(r.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(r.headers['content-disposition']).toContain('attachment; filename="entrenamientos_atletas_');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(r.body);
        const sheet = workbook.getWorksheet('Entrenamientos');
        expect(sheet).toBeTruthy();

        const headerRow = sheet.getRow(1).values.filter(Boolean);
        expect(headerRow).toEqual(expect.arrayContaining(['Atleta', 'Ejercicio', 'Notas del entrenamiento']));

        const rows = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) { return; }
            rows.push(row.values);
        });
        expect(rows.length).toBe(2);

        const exerciseNames = rows.map(row => row[7]);
        expect(exerciseNames).toEqual(expect.arrayContaining(['Squat', 'Dominadas']));

        const statsSheet = workbook.getWorksheet('Estadísticas');
        expect(statsSheet).toBeTruthy();

        const statsHeaderRow = statsSheet.getRow(1).values.filter(Boolean);
        expect(statsHeaderRow).toEqual(expect.arrayContaining([
            'Atleta', 'Sesiones registradas', 'Sesiones completadas', 'Horas totales entrenadas', 'Ejercicio más frecuente',
        ]));

        const statsRows = [];
        statsSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) { return; }
            statsRows.push(row.values);
        });
        expect(statsRows.length).toBe(1);
        // [empty, athleteName, athleteEmail, totalSessions, completedSessions, totalHours, topExercise, firstDate, lastDate]
        expect(statsRows[0][3]).toBe(1);
        expect(statsRows[0][4]).toBe(1);
    });

    it('no incluye logs del atleta hechos en planes de otro coach', async () => {
        const otherCoach = await User.create({ name: 'Other Coach', email: 'othercoach-export@test.com', password: 'Password1', role: 'coach', isVerified: true });
        const otherPlan = await TrainingPlan.create({ name: 'OtherCoachPlan', coach: otherCoach._id, athletes: [athleteId], startDate: new Date(), endDate: new Date() });
        const otherWorkout = await Workout.create({ name: 'OtherWorkout', plan: otherPlan._id, coach: otherCoach._id, date: new Date() });
        await WorkoutLog.create({
            workout: otherWorkout._id,
            athlete: athleteId,
            completed: true,
            exercises: [{ name: 'Peso Muerto', sets: 5, reps: 5, load: '100kg', completed: true }],
        });

        const r = await request(app).get('/api/training/logs/export/coach')
            .set('Authorization', `Bearer ${coachToken}`)
            .buffer(true)
            .parse((res, callback) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => callback(null, Buffer.concat(chunks)));
            });

        expect(r.status).toBe(200);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(r.body);
        const sheet = workbook.getWorksheet('Entrenamientos');

        const rows = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) { return; }
            rows.push(row.values);
        });
        // Sigue siendo solo lo del plan propio del coach (2 filas del test
        // anterior): el ejercicio del plan de otro coach no debe aparecer.
        const exerciseNames = rows.map(row => row[7]);
        expect(exerciseNames).not.toContain('Peso Muerto');
    });
});
