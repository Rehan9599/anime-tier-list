import { Router } from 'express';
import { getHistory } from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/:friendId', protect, getHistory);

export default router;
