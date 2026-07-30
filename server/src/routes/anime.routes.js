import { Router } from 'express';
import { top, search, trending, genreList, byGenre } from '../controllers/anime.controller.js';
import { protect } from '../middleware/auth.middleware.js';
 
const router = Router();
 
router.get('/top', protect, top);
router.get('/search', protect, search);
router.get('/trending', protect, trending);
router.get('/genres', protect, genreList);
router.get('/genre', protect, byGenre);
 
export default router;