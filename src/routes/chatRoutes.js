import express from 'express';
import { getPlanMessages, createMessage } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/', getPlanMessages);
router.post('/', createMessage);

export default router;
