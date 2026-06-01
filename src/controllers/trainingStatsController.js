import TrainingStats from '../models/TrainingStats.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';
import Workout from '../models/templates/Workout.js';
import TrainingPlan from '../models/templates/TrainingPlan.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import {
    getWeekBounds,
    getWeekLabel,
    startOfDay,
    endOfDay,
    topCountsFromMap,
} from '../utils/dashboardStatsHelpers.js';

async function buildAthleteDashboard(userId) {
    const planIds = await TrainingPlan.find({ athletes: userId, isActive: true }).distinct('_id');
    const stats = await TrainingStats.findOne({ user: userId, isActive: { $ne: false } });

    const weeklyActivity = [];
    for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo--) {
        const { start, end } = getWeekBounds(weeksAgo);
        const scheduled = planIds.length
            ? await Workout.countDocuments({
                plan: { $in: planIds },
                isActive: true,
                date: { $gte: start, $lte: end },
            })
            : 0;
        const completed = await WorkoutLog.countDocuments({
            athlete: userId,
            isActive: true,
            completed: true,
            date: { $gte: start, $lte: end },
        });
        weeklyActivity.push({
            label: getWeekLabel(weeksAgo),
            completed,
            scheduled,
        });
    }

    const logs = await WorkoutLog.find({ athlete: userId, isActive: true }).select('exercises');
    const exerciseCount = {};
    logs.forEach((log) => {
        (log.exercises || []).forEach((ex) => {
            if (ex?.name) {
                exerciseCount[ex.name] = (exerciseCount[ex.name] || 0) + 1;
            }
        });
    });

    const current = weeklyActivity[weeklyActivity.length - 1];
    const adherence =
        current.scheduled > 0
            ? Math.min(100, Math.round((current.completed / current.scheduled) * 100))
            : 0;

    const totalCompleted = await WorkoutLog.countDocuments({
        athlete: userId,
        isActive: true,
        completed: true,
    });

    return {
        role: 'athlete',
        summary: {
            totalCompleted,
            bestLifts: stats?.bestLifts?.length ?? 0,
            weeklyAdherence: adherence,
            scheduledThisWeek: current.scheduled,
            completedThisWeek: current.completed,
        },
        charts: {
            weeklyActivity,
            topExercises: topCountsFromMap(exerciseCount),
        },
    };
}

async function buildCoachDashboard(coachId) {
    const plans = await TrainingPlan.find({ coach: coachId, isActive: true })
        .populate('athletes', 'name')
        .select('name athletes')
        .lean();

    const planIds = plans.map((p) => p._id);
    const coachWorkoutIds =
        planIds.length > 0
            ? await Workout.find({ plan: { $in: planIds }, isActive: true }).distinct('_id')
            : [];

    // Mapa atleta → { name, planIds donde está inscrito }
    const athleteMap = new Map();
    plans.forEach((plan) => {
        (plan.athletes || []).forEach((a) => {
            const id = (a._id || a).toString();
            const existing = athleteMap.get(id) || {
                name: a.name || 'Atleta',
                planIds: [],
            };
            existing.planIds.push(plan._id);
            athleteMap.set(id, existing);
        });
    });

    const weeklyTeamActivity = [];
    for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo--) {
        const { start, end } = getWeekBounds(weeksAgo);
        const scheduled =
            planIds.length > 0
                ? await Workout.countDocuments({
                    plan: { $in: planIds },
                    isActive: true,
                    date: { $gte: start, $lte: end },
                })
                : 0;
        const completed =
            coachWorkoutIds.length > 0 && athleteMap.size > 0
                ? await WorkoutLog.countDocuments({
                    athlete: { $in: [...athleteMap.keys()] },
                    workout: { $in: coachWorkoutIds },
                    isActive: true,
                    completed: true,
                    date: { $gte: start, $lte: end },
                })
                : 0;
        weeklyTeamActivity.push({
            label: getWeekLabel(weeksAgo),
            completed,
            scheduled,
        });
    }

    const { start: weekStart, end: weekEnd } = getWeekBounds(0);
    const athleteMetrics = [];

    for (const [athleteId, info] of athleteMap.entries()) {
        const scheduledThisWeek =
            info.planIds.length > 0
                ? await Workout.countDocuments({
                    plan: { $in: info.planIds },
                    isActive: true,
                    date: { $gte: weekStart, $lte: weekEnd },
                })
                : 0;

        const completedThisWeek =
            coachWorkoutIds.length > 0
                ? await WorkoutLog.countDocuments({
                    athlete: athleteId,
                    workout: { $in: coachWorkoutIds },
                    isActive: true,
                    completed: true,
                    date: { $gte: weekStart, $lte: weekEnd },
                })
                : 0;

        const pending = Math.max(0, scheduledThisWeek - completedThisWeek);
        const adherence =
            scheduledThisWeek > 0
                ? Math.min(100, Math.round((completedThisWeek / scheduledThisWeek) * 100))
                : completedThisWeek > 0
                  ? 100
                  : 0;

        athleteMetrics.push({
            id: athleteId,
            name: info.name,
            scheduledThisWeek,
            completedThisWeek,
            pending,
            adherence,
        });
    }

    // Atletas más activos (por sesiones completadas esta semana)
    const topAthletes = [...athleteMetrics]
        .sort((a, b) => b.completedThisWeek - a.completedThisWeek)
        .filter((a) => a.completedThisWeek > 0)
        .slice(0, 5)
        .map((a) => ({
            label: a.name.length > 14 ? `${a.name.slice(0, 12)}…` : a.name,
            value: a.completedThisWeek,
        }));

    // Atletas que requieren seguimiento (tienen sesiones pendientes esta semana)
    const athletesAtRisk = [...athleteMetrics]
        .filter((a) => a.pending > 0)
        .sort((a, b) => b.pending - a.pending)
        .slice(0, 6)
        .map((a) => ({
            label: a.name.length > 14 ? `${a.name.slice(0, 12)}…` : a.name,
            value: a.pending,
            secondaryLabel: `${a.completedThisWeek}/${a.scheduledThisWeek}`,
        }));

    // Cumplimiento por plan solo de la semana actual (más útil que histórico acumulado)
    const planWeeklySnapshot = [];
    for (const plan of plans.slice(0, 6)) {
        const scheduled = await Workout.countDocuments({
            plan: plan._id,
            isActive: true,
            date: { $gte: weekStart, $lte: weekEnd },
        });
        const workoutIds = await Workout.find({
            plan: plan._id,
            isActive: true,
            date: { $gte: weekStart, $lte: weekEnd },
        }).distinct('_id');
        const completed =
            workoutIds.length > 0 && plan.athletes?.length
                ? await WorkoutLog.countDocuments({
                    workout: { $in: workoutIds },
                    athlete: { $in: plan.athletes.map((a) => a._id || a) },
                    isActive: true,
                    completed: true,
                    date: { $gte: weekStart, $lte: weekEnd },
                })
                : 0;
        const expected = scheduled * Math.max(plan.athletes?.length ?? 0, 1);
        const value =
            expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0;
        planWeeklySnapshot.push({ label: plan.name, value, completed, scheduled: expected });
    }

    const currentWeek = weeklyTeamActivity[weeklyTeamActivity.length - 1];
    const teamWeeklyAdherence =
        currentWeek.scheduled > 0
            ? Math.min(100, Math.round((currentWeek.completed / currentWeek.scheduled) * 100))
            : 0;

    const activeAthletesThisWeek = athleteMetrics.filter((a) => a.completedThisWeek > 0).length;
    const pendingSessionsThisWeek = athleteMetrics.reduce((s, a) => s + a.pending, 0);
    const athletesNeedingAttention = athleteMetrics.filter((a) => a.pending > 0).length;

    const insights = [];
    if (athleteMap.size === 0) {
        insights.push('Inscribe atletas en tus planes para empezar a ver su actividad.');
    } else if (athletesNeedingAttention === 0 && currentWeek.scheduled > 0) {
        insights.push('Tu equipo va al día: no hay sesiones pendientes esta semana.');
    } else if (athletesNeedingAttention > 0) {
        insights.push(
            `${athletesNeedingAttention} atleta${athletesNeedingAttention > 1 ? 's' : ''} con sesiones pendientes esta semana.`
        );
    }
    if (activeAthletesThisWeek === 0 && athleteMap.size > 0) {
        insights.push('Ningún atleta ha registrado entrenos esta semana.');
    } else if (activeAthletesThisWeek > 0) {
        insights.push(
            `${activeAthletesThisWeek} de ${athleteMap.size} atletas han entrenado esta semana.`
        );
    }

    return {
        role: 'coach',
        summary: {
            activePlans: plans.length,
            athletesManaged: athleteMap.size,
            activeAthletesThisWeek,
            pendingSessionsThisWeek,
            teamWeeklyAdherence,
            athletesNeedingAttention,
        },
        charts: {
            weeklyTeamActivity,
            topAthletes,
            athletesAtRisk,
            planWeeklySnapshot,
        },
        insights,
    };
}

async function buildAdminDashboard() {
    const roles = ['athlete', 'coach', 'admin'];
    const roleLabels = { athlete: 'Atletas', coach: 'Entrenadores', admin: 'Admins' };
    const usersByRole = [];

    for (const role of roles) {
        const value = await User.countDocuments({ role, isDeleted: false });
        usersByRole.push({ label: roleLabels[role], value });
    }

    const dailyActivity = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const count = await WorkoutLog.countDocuments({
            isActive: true,
            date: { $gte: startOfDay(d), $lte: endOfDay(d) },
        });
        dailyActivity.push({
            label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
            value: count,
        });
    }

    const [activePlans, verifiedUsers, deletedUsers, totalLogs] = await Promise.all([
        TrainingPlan.countDocuments({ isActive: true }),
        User.countDocuments({ isDeleted: false, isVerified: true }),
        User.countDocuments({ isDeleted: true }),
        WorkoutLog.countDocuments({ isActive: true, completed: true }),
    ]);

    return {
        role: 'admin',
        summary: {
            totalUsers: usersByRole.reduce((s, r) => s + r.value, 0),
            activePlans,
            verifiedUsers,
            deletedUsers,
            completedLogs: totalLogs,
        },
        charts: {
            usersByRole,
            dailyActivity,
        },
    };
}

/** Estadísticas de panel según rol (atleta, coach o admin) */
export const getDashboardStats = catchAsync(async (req, res, next) => {
    const { role, _id: userId } = req.user;

    if (role === 'athlete') {
        return res.status(200).json(await buildAthleteDashboard(userId));
    }
    if (role === 'coach') {
        return res.status(200).json(await buildCoachDashboard(userId));
    }
    if (role === 'admin') {
        return res.status(200).json(await buildAdminDashboard());
    }

    return next(new AppError('Rol no soportado para estadísticas', 403));
});

// Obtener progreso de un ejercicio específico (historial de logs)
export const getExerciseProgress = catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    const { exercise } = req.query;

    // Verificar permiso: solo el propio usuario, su coach o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'coach') {
        return next(new AppError('No tienes permiso para ver el progreso de este usuario', 403));
    }

    if (!exercise) {
        return next(new AppError('Se requiere el parámetro "exercise"', 400));
    }

    // Buscar logs del usuario que contengan el ejercicio
    const logs = await WorkoutLog.find({
        athlete: userId,
        isActive: true,
        'exercises.name': exercise
    })
        .select('date exercises')
        .sort({ date: 1 }); // Orden cronológico ascendente

    // Extraer los datos relevantes para la gráfica
    const progressData = logs.map(log => {
        const exerciseData = log.exercises.find(e => e.name === exercise);
        return {
            date: log.date,
            value: exerciseData ? exerciseData.load : null, // Asumimos load como valor principal, podría ser reps o algo compuesto
            reps: exerciseData ? exerciseData.reps : null,
            sets: exerciseData ? exerciseData.sets : null
        };
    }).filter(item => item.value !== null); // Filtrar si no hay datos

    res.status(200).json(progressData);
});

// Crear estadísticas iniciales para un usuario
export const createStats = catchAsync(async (req, res, next) => {
    const { userId } = req.body;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para crear estadísticas de otro usuario', 403));
    }

    const existingStats = await TrainingStats.findOne({ user: userId });
    if (existingStats) {
        return next(new AppError('El usuario ya tiene estadísticas registradas', 400));
    }

    const newStats = new TrainingStats({
        user: userId,
        totalWorkouts: 0,
        totalExercises: 0,
        bestLifts: []
    });

    await newStats.save();

    res.status(201).json(newStats);
});

// Obtener estadísticas de un usuario
export const getStats = catchAsync(async (req, res, next) => {
    const { userId } = req.params;

    // Verificar permiso: propio usuario, coach o admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'coach') {
        return next(new AppError('No tienes permiso para ver las estadísticas de este usuario', 403));
    }

    const stats = await TrainingStats.findOne({ user: userId });

    if (!stats) {
        return next(new AppError('Estadísticas no encontradas para este usuario', 404));
    }

    res.status(200).json(stats);
});

// Actualizar estadísticas (pueden ser contadores o nuevos PRs)
export const updateStats = catchAsync(async (req, res, next) => {
    const { userId } = req.params;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para modificar las estadísticas de otro usuario', 403));
    }

    // Whitelist: solo se permiten actualizar estos campos para evitar mass-assignment
    const ALLOWED_FIELDS = ['totalWorkouts', 'totalExercises', 'lastWorkoutDate', 'bestLifts'];
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        return next(new AppError('No se han proporcionado campos válidos para actualizar', 400));
    }

    const stats = await TrainingStats.findOneAndUpdate(
        { user: userId },
        updates,
        { new: true, runValidators: true }
    );

    if (!stats) {
        return next(new AppError('Estadísticas no encontradas', 404));
    }

    res.status(200).json(stats);
});

// Eliminar (soft delete) estadísticas de un usuario
export const deleteStats = catchAsync(async (req, res, next) => {
    const { userId } = req.params;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para eliminar las estadísticas de otro usuario', 403));
    }

    const stats = await TrainingStats.findOneAndUpdate(
        { user: userId },
        { isActive: false },
        { new: true }
    );

    if (!stats) {
        return next(new AppError('Estadísticas no encontradas', 404));
    }

    res.status(200).json({ message: 'Estadísticas desactivadas con éxito', stats });
});
