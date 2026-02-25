import TrainingStats from '../models/TrainingStats.js';
import WorkoutLog from '../models/logs/WorkoutLog.js';

// Obtener progreso de un ejercicio específico (historial de logs)
export const getExerciseProgress = async (req, res) => {
    try {
        const { userId } = req.params;
        const { exercise } = req.query;

        if (!exercise) {
            return res.status(400).json({ message: 'Se requiere el parámetro "exercise"' });
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
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener progreso', error: error.message });
    }
};

// Crear estadísticas iniciales para un usuario
export const createStats = async (req, res) => {
    try {
        const { userId } = req.body;

        const existingStats = await TrainingStats.findOne({ user: userId });
        if (existingStats) {
            return res.status(400).json({ message: 'El usuario ya tiene estadísticas registradas' });
        }

        const newStats = new TrainingStats({
            user: userId,
            totalWorkouts: 0,
            totalExercises: 0,
            bestLifts: []
        });

        await newStats.save();

        res.status(201).json(newStats);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear estadísticas', error: error.message });
    }
};

// Obtener estadísticas de un usuario
export const getStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const stats = await TrainingStats.findOne({ user: userId });

        if (!stats) {
            return res.status(404).json({ message: 'Estadísticas no encontradas para este usuario' });
        }

        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
    }
};

// Actualizar estadísticas (pueden ser contadores o nuevos PRs)
export const updateStats = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        const stats = await TrainingStats.findOneAndUpdate(
            { user: userId },
            updates,
            { new: true, runValidators: true }
        );

        if (!stats) {
            return res.status(404).json({ message: 'Estadísticas no encontradas' });
        }

        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar estadísticas', error: error.message });
    }
};

// Eliminar (soft delete) estadísticas de un usuario
export const deleteStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const stats = await TrainingStats.findOneAndUpdate(
            { user: userId },
            { isActive: false },
            { new: true }
        );

        if (!stats) {
            return res.status(404).json({ message: 'Estadísticas no encontradas' });
        }

        res.status(200).json({ message: 'Estadísticas desactivadas con éxito', stats });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar estadísticas', error: error.message });
    }
};
