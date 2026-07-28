import { Router } from 'express';
import { getPrompt, submitStatus, listWatched } from '../controllers/watched.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/prompt', protect, getPrompt);
router.post('/', protect, submitStatus);
router.get('/', protect, listWatched);

export default router;
