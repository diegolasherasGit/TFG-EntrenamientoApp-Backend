import express from 'express';
import {
    createWorkout,
    getPlanWorkouts,
    getMyCalendarWorkouts,
    getWorkoutById,
    updateWorkout,
    deleteWorkout
} from '../controllers/workoutController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('coach', 'admin'), createWorkout);
router.get('/plan/:planId', getPlanWorkouts);
router.get('/calendar/my-calendar', getMyCalendarWorkouts);
router.get('/:id', getWorkoutById);
router.put('/:id', restrictTo('coach', 'admin'), updateWorkout);
router.delete('/:id', restrictTo('coach', 'admin'), deleteWorkout);

export default router;
