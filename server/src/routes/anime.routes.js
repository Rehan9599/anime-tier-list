import { Router } from 'express';
import { top, search } from '../controllers/anime.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/top', protect, top);
router.get('/search', protect, search);

export default router;
