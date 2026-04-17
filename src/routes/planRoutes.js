import express from 'express';
import {
    createPlan,
    getAthletePlans,
    getCoachPlans,
    getPlanById,
    updatePlan,
    deletePlan,
    getAllActivePlans,
    enrollAthlete
} from '../controllers/planController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('coach', 'admin'), createPlan);
router.get('/', getAllActivePlans);
router.get('/athlete/:athleteId', getAthletePlans);
router.get('/coach/:coachId', getCoachPlans);
router.get('/:id', getPlanById);
router.post('/:id/enroll', enrollAthlete);
router.put('/:id', restrictTo('coach', 'admin'), updatePlan);
router.delete('/:id', restrictTo('coach', 'admin'), deletePlan);

export default router;
