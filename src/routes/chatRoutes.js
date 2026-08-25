import express from 'express';
import { getPlanMessages, createMessage } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createMessageSchema } from '../schemas/chatSchemas.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/', getPlanMessages);
router.post('/', validate(createMessageSchema), createMessage);

export default router;
