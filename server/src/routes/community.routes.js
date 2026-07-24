import { Router } from 'express';
import { createSession, getSession } from '../controllers/community.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/sessions', protect, createSession);
router.get('/sessions/:roomCode', protect, getSession);

export default router;
