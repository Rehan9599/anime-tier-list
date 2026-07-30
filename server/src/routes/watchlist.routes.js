import { Router } from 'express';
import { addToWatchlist, listWatchlist, removeFromWatchlist } from '../controllers/watchlist.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/', protect, addToWatchlist);
router.get('/', protect, listWatchlist);
router.delete('/:animeId', protect, removeFromWatchlist);

export default router;
