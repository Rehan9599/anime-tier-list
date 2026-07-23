import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  searchUsers,
  sendRequest,
  listIncomingRequests,
  respondToRequest,
  listFriends,
} from '../controllers/friends.controller.js';
import { protect } from '../middleware/auth.middleware.js';

// Blunts both accidental hammering and brute-force-y spamming of requests.
const requestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

const router = Router();

router.get('/search', protect, searchUsers);
router.post('/request', protect, requestLimiter, sendRequest);
router.get('/requests', protect, listIncomingRequests);
router.post('/requests/:requestId/respond', protect, respondToRequest);
router.get('/', protect, listFriends);

export default router;
