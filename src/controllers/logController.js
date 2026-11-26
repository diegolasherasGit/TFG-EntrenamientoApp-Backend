import ExcelJS from 'exceljs';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import Workout from '../models/templates/Workout.js';
import catchAsync from '../utils/catchAsync.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import AppError from '../utils/AppError.js';
import { notifyAthletes } from '../utils/notifyAthletes.js';
import { ROLES } from '../constants/roles.js';
import logger from '../config/logger.js';

/**
 * Controller para el registro de ejecuciones (Logs)
 */

// Registrar ejecución de entrenamiento por un atleta
export const logWorkoutResult = catchAsync(async (req, res) => {
    const { workoutId, exercises, completed, notes, date } = req.body;

    // Forzar athleteId desde el usuario autenticado para evitar suplantación
    const athleteId = req.user._id;

    const newLog = new WorkoutLog({
        workout: workoutId,
        athlete: athleteId,
        exercises,
        completed,
        notes,
        date
    });

    await newLog.save();

    // Cuando el atleta COMPLETA un entreno, avisar al coach del plan (in-app + push).
    // Best-effort: un fallo de notificación no debe tumbar el guardado del log.
    if (completed) {
        try {
            const workout = await Workout.findById(workoutId).populate({ path: 'plan', select: 'coach' });
            const coachId = workout?.plan?.coach;
            if (coachId) {
                await notifyAthletes([coachId], {
                    type: 'system',
                    title: 'Entrenamiento completado',
                    message: `${req.user.name} ha completado "${workout.name}".`,
                    relatedId: workout._id,
                });
            }
        } catch (err) {
            logger.error(`No se pudo notificar al coach del entreno completado: ${err.message}`);
        }
    }

    res.status(201).json({ message: 'Log de entrenamiento guardado', log: newLog });
});

// Obtener historial de entrenamientos de un atleta (solo activos)
export const getAthleteLogs = catchAsync(async (req, res, next) => {
    const { athleteId } = req.params;

    // Verificar permiso: el propio atleta o un admin pueden ver siempre. Un coach
    // solo puede ver los logs de atletas inscritos en alguno de SUS planes activos.
    const isSelf = req.user._id.toString() === athleteId;
    const isAdmin = req.user.role === ROLES.ADMIN;
    let allowed = isSelf || isAdmin;
    let coachPlanIds = null;
    if (!allowed && req.user.role === ROLES.COACH) {
        coachPlanIds = await TrainingPlan.find({ coach: req.user._id, athletes: athleteId, isActive: true }).distinct('_id');
        allowed = coachPlanIds.length > 0;
    }
    if (!allowed) {
        return next(new AppError('No tienes permiso para ver los logs de este atleta', 403));
    }

    // Sort por defecto: el día más reciente primero
    if (!req.query.sort) {
        req.query.sort = '-date';
    }

    const logFilter = { athlete: athleteId, isActive: true };

    // Un coach solo ve los registros hechos en SUS propios planes activos con
    // este atleta, no los de otros coaches ni los de planes que ya ha archivado.
    if (req.user.role === ROLES.COACH && !isAdmin) {
        const workoutIds = await Workout.find({ plan: { $in: coachPlanIds }, isActive: true }).distinct('_id');
        logFilter.workout = { $in: workoutIds };
    }

    const query = WorkoutLog.find(logFilter).populate('workout', 'name estimatedDuration');

    const features = new ApiFeatures(query, req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const logs = await features.query;
    const total = await WorkoutLog.countDocuments(logFilter);

    res.status(200).json({
        total,
        count: logs.length,
        logs
    });
});

// Actualizar un log de entrenamiento
export const updateLog = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    // workout e isActive son inmutables desde el cliente:
    //   - workout: no se puede reasignar un log a otra sesión
    //   - isActive: el borrado se gestiona exclusivamente por deleteLog
    const { exercises, completed, notes, date } = req.body;

    const log = await WorkoutLog.findById(id);
    if (!log) {
        return next(new AppError('Log no encontrado', 404));
    }

    // Verificar permiso: solo el atleta dueño del log o un admin
    if (req.user._id.toString() !== log.athlete.toString() && req.user.role !== ROLES.ADMIN) {
        return next(new AppError('No tienes permiso para modificar este log', 403));
    }

    const updatedLog = await WorkoutLog.findByIdAndUpdate(
        id,
        { exercises, completed, notes, date },
        { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'Log actualizado con éxito', log: updatedLog });
});

// Eliminar un log de entrenamiento (Soft Delete)
export const deleteLog = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const log = await WorkoutLog.findById(id);
    if (!log) {
        return next(new AppError('Log no encontrado', 404));
    }

    // Verificar permiso: solo el atleta dueño del log o un admin
    if (req.user._id.toString() !== log.athlete.toString() && req.user.role !== ROLES.ADMIN) {
        return next(new AppError('No tienes permiso para eliminar este log', 403));
    }

    log.isActive = false;
    await log.save();

    res.status(200).json({ message: 'Log de entrenamiento eliminado (soft delete)', log });
});

const ATHLETE_SHEET_COLUMNS = [
    { header: 'Plan', key: 'planName', width: 26 },
    { header: 'Entrenamiento', key: 'workoutName', width: 26 },
    { header: 'Fecha', key: 'date', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Ejercicio', key: 'exerciseName', width: 26 },
    { header: 'Tipo', key: 'trackingType', width: 14 },
    { header: 'Series', key: 'sets', width: 8 },
    { header: 'Reps', key: 'reps', width: 8 },
    { header: 'Duración', key: 'duration', width: 12 },
    { header: 'Distancia', key: 'distance', width: 12 },
    { header: 'Carga', key: 'load', width: 10 },
    { header: 'Notas del ejercicio', key: 'exerciseNotes', width: 32 },
    { header: 'Notas del entrenamiento', key: 'sessionNotes', width: 32 },
];

const STATS_COLUMNS = [
    { header: 'Atleta', key: 'athleteName', width: 24 },
    { header: 'Email', key: 'athleteEmail', width: 28 },
    { header: 'Sesiones completadas', key: 'completedSessions', width: 18 },
    { header: 'Planes terminados al 100 %', key: 'completedPlans', width: 24 },
    { header: 'Sesiones pendientes (todos los planes)', key: 'notDoneWorkouts', width: 34 },
    { header: 'Horas totales entrenadas', key: 'totalHours', width: 20 },
    { header: 'Ejercicio más frecuente', key: 'topExercise', width: 26 },
    { header: 'Primer registro', key: 'firstDate', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Último registro', key: 'lastDate', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
];

// Etiquetas del tipo de seguimiento tal y como las ve el usuario en la app.
const TRACKING_TYPE_LABELS = { reps: 'Repeticiones', time: 'Tiempo', distance: 'Distancia' };

// La app envía 0 en series/repeticiones cuando el tipo de seguimiento no las
// usa (una travesía no tiene series); en la hoja se dejan en blanco.
const countOrBlank = (value) => (value ? value : '');

// Excel prohíbe \ / ? * [ ] : en el nombre de una hoja, exige <= 31 caracteres
// y no permite nombres duplicados en el mismo libro.
function makeSheetName(rawName, usedNames) {
    let base = (rawName || 'Escalador').replace(/[\\/?*[\]:]/g, ' ').trim();
    if (!base) { base = 'Escalador'; }
    base = base.slice(0, 31);

    let name = base;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
        const tag = ` (${suffix})`;
        name = `${base.slice(0, 31 - tag.length)}${tag}`;
        suffix += 1;
    }
    usedNames.add(name.toLowerCase());
    return name;
}

// Agrega, por atleta, un resumen estadístico a partir de sus WorkoutLogs y del
// progreso por plan ya calculado en buildPlanProgress.
function buildAthleteStats(logs, planProgressByAthlete) {
    const byAthlete = new Map();

    for (const log of logs) {
        const athleteId = (log.athlete?._id || log.athlete)?.toString();
        if (!athleteId) { continue; }

        if (!byAthlete.has(athleteId)) {
            byAthlete.set(athleteId, {
                athleteId,
                athleteName: log.athlete?.name || 'Escalador/a eliminado',
                athleteEmail: log.athlete?.email || '',
                completedSessions: 0,
                totalMinutes: 0,
                exerciseCount: {},
                firstDate: null,
                lastDate: null,
            });
        }

        const entry = byAthlete.get(athleteId);
        if (log.completed) {
            entry.completedSessions += 1;
            entry.totalMinutes += log.workout?.estimatedDuration || 60;
        }
        (log.exercises || []).forEach((ex) => {
            if (ex?.name) { entry.exerciseCount[ex.name] = (entry.exerciseCount[ex.name] || 0) + 1; }
        });

        const logDate = log.date ? new Date(log.date) : null;
        if (logDate) {
            if (!entry.firstDate || logDate < entry.firstDate) { entry.firstDate = logDate; }
            if (!entry.lastDate || logDate > entry.lastDate) { entry.lastDate = logDate; }
        }
    }

    return [...byAthlete.values()]
        .sort((a, b) => a.athleteName.localeCompare(b.athleteName, 'es'))
        .map((entry) => {
            const topExercise = Object.entries(entry.exerciseCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
            const progress = planProgressByAthlete.get(entry.athleteId) || { completedPlans: 0, notDoneWorkouts: 0 };
            return {
                athleteName: entry.athleteName,
                athleteEmail: entry.athleteEmail,
                completedSessions: entry.completedSessions,
                completedPlans: progress.completedPlans,
                notDoneWorkouts: progress.notDoneWorkouts,
                totalHours: Math.round((entry.totalMinutes / 60) * 10) / 10,
                topExercise,
                firstDate: entry.firstDate,
                lastDate: entry.lastDate,
            };
        });
}

// Para cada atleta: en cuántos de sus planes YA TERMINADOS (endDate pasado)
// completó todos los entrenamientos programados, y de entre los
// entrenamientos que ya deberían haberse hecho (fecha pasada), cuántos se
// quedaron sin un log marcado como completado. Los entrenamientos futuros no
// cuentan como "no realizados" todavía.
function buildPlanProgress(athleteIds, plans, workoutsByPlan, logs) {
    const now = new Date();

    const completedWorkoutIdsByAthlete = new Map();
    for (const log of logs) {
        if (!log.completed) { continue; }
        const athleteId = (log.athlete?._id || log.athlete)?.toString();
        const workoutId = (log.workout?._id || log.workout)?.toString();
        if (!athleteId || !workoutId) { continue; }
        if (!completedWorkoutIdsByAthlete.has(athleteId)) {
            completedWorkoutIdsByAthlete.set(athleteId, new Set());
        }
        completedWorkoutIdsByAthlete.get(athleteId).add(workoutId);
    }

    const progressByAthlete = new Map();
    for (const athleteId of athleteIds) {
        const completedWorkoutIds = completedWorkoutIdsByAthlete.get(athleteId) || new Set();
        let completedPlans = 0;
        let notDoneWorkouts = 0;

        for (const plan of plans) {
            const isEnrolled = plan.athletes.some((a) => a.toString() === athleteId);
            if (!isEnrolled) { continue; }

            const planWorkouts = workoutsByPlan.get(plan._id.toString()) || [];
            const dueWorkouts = planWorkouts.filter((w) => w.date <= now);
            notDoneWorkouts += dueWorkouts.filter((w) => !completedWorkoutIds.has(w.id)).length;

            const planIsOver = plan.endDate <= now;
            const allDone = planWorkouts.length > 0 && planWorkouts.every((w) => completedWorkoutIds.has(w.id));
            if (planIsOver && allDone) { completedPlans += 1; }
        }

        progressByAthlete.set(athleteId, { completedPlans, notDoneWorkouts });
    }

    return progressByAthlete;
}

// Exportar a Excel los registros (WorkoutLogs) de los atletas inscritos en los
// planes activos del coach autenticado: una hoja de estadísticas y, después,
// una hoja de detalle por atleta (una fila por ejercicio registrado en su hoja).
export const exportCoachAthleteLogs = catchAsync(async (req, res, next) => {
    const coachId = req.user._id;

    const plans = await TrainingPlan.find({ coach: coachId, isActive: true }).select('athletes name endDate');
    const athleteIds = [...new Set(plans.flatMap(plan => plan.athletes.map(a => a.toString())))];

    if (athleteIds.length === 0) {
        return next(new AppError('No tienes escaladores/as inscritos en tus planes todavía', 404));
    }

    // Solo los registros hechos en los propios planes activos del coach, no
    // los que esos mismos atletas tengan en planes de otros coaches.
    const planIds = plans.map(plan => plan._id);
    const planNameById = new Map(plans.map(plan => [plan._id.toString(), plan.name]));

    const workouts = await Workout.find({ plan: { $in: planIds }, isActive: true }).select('plan date').lean();
    const workoutsByPlan = new Map();
    for (const workout of workouts) {
        const planId = workout.plan.toString();
        if (!workoutsByPlan.has(planId)) { workoutsByPlan.set(planId, []); }
        workoutsByPlan.get(planId).push({ id: workout._id.toString(), date: workout.date });
    }
    const workoutIds = workouts.map(w => w._id);

    const logs = await WorkoutLog.find({ athlete: { $in: athleteIds }, workout: { $in: workoutIds }, isActive: true })
        .populate('athlete', 'name email')
        .populate('workout', 'name estimatedDuration plan')
        .lean();

    logs.sort((a, b) => {
        const nameCompare = (a.athlete?.name || '').localeCompare(b.athlete?.name || '', 'es');
        if (nameCompare !== 0) { return nameCompare; }
        return new Date(a.date) - new Date(b.date);
    });

    const planProgressByAthlete = buildPlanProgress(athleteIds, plans, workoutsByPlan, logs);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bulderland';
    workbook.created = new Date();

    const statsSheet = workbook.addWorksheet('Estadísticas');
    statsSheet.columns = STATS_COLUMNS;
    statsSheet.getRow(1).font = { bold: true };
    statsSheet.getRow(1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' },
    };
    statsSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: STATS_COLUMNS.length } };

    for (const stats of buildAthleteStats(logs, planProgressByAthlete)) {
        statsSheet.addRow(stats);
    }

    // Una hoja de detalle por atleta, con su nombre como título de la hoja, en
    // el mismo orden en que ya aparecían agrupados en la hoja combinada anterior.
    const logsByAthlete = new Map();
    for (const log of logs) {
        const athleteId = (log.athlete?._id || log.athlete)?.toString();
        if (!athleteId) { continue; }
        if (!logsByAthlete.has(athleteId)) { logsByAthlete.set(athleteId, []); }
        logsByAthlete.get(athleteId).push(log);
    }

    const usedSheetNames = new Set(['estadísticas']);
    for (const [, athleteLogs] of logsByAthlete) {
        const athleteName = athleteLogs[0].athlete?.name || 'Escalador/a eliminado';
        const sheet = workbook.addWorksheet(makeSheetName(athleteName, usedSheetNames), {
            views: [{ state: 'frozen', ySplit: 1 }],
        });
        sheet.columns = ATHLETE_SHEET_COLUMNS;
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' },
        };
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ATHLETE_SHEET_COLUMNS.length } };

        for (const log of athleteLogs) {
            const baseRow = {
                planName: planNameById.get(log.workout?.plan?.toString()) || '',
                workoutName: log.workout?.name || 'Sesión eliminada',
                date: log.date ? new Date(log.date) : null,
                sessionNotes: log.notes || '',
            };

            if (!log.exercises || log.exercises.length === 0) { sheet.addRow(baseRow); continue; }

            for (const ex of log.exercises) {
                sheet.addRow({
                    ...baseRow,
                    exerciseName: ex.name || '',
                    trackingType: TRACKING_TYPE_LABELS[ex.trackingType] || ex.trackingType || '',
                    sets: countOrBlank(ex.sets),
                    reps: countOrBlank(ex.reps),
                    duration: ex.duration || '',
                    distance: ex.distance || '',
                    load: ex.load || '',
                    exerciseNotes: ex.notes || '',
                });
            }
        }
    }

    const filename = `entrenamientos_atletas_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
});
