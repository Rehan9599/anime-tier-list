import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getTierList, saveTierList, emailTierList, getRecommendations } from '../controllers/tierlist.controller.js';
import { protect } from '../middleware/auth.middleware.js';

// The email route costs deliverability/reputation if abused -- keep it tighter
// than the general API rate limit.
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Too many emails requested. Try again later.' },
});

const router = Router();

router.get('/', protect, getTierList);
router.put('/', protect, saveTierList);
router.post('/email', protect, emailLimiter, emailTierList);
router.get('/recommendations', protect, getRecommendations);

export default router;
